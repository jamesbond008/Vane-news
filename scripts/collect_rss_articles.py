#!/usr/bin/env python3
"""Collect RSS/Atom items from active sources and store them as candidate news."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sqlite3
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "vane_news.sqlite"
DEFAULT_SCHEMA = ROOT / "database" / "schema.sql"
USER_AGENT = "VANE-News/0.1 (+https://github.com/jamesbond008/Vane-news)"


def ensure_schema(conn: sqlite3.Connection) -> None:
  conn.executescript(DEFAULT_SCHEMA.read_text(encoding="utf-8"))


def strip_html(value: str | None) -> str:
  if not value:
    return ""
  text = re.sub(r"<[^>]+>", " ", value)
  text = html.unescape(text)
  return re.sub(r"\s+", " ", text).strip()


def local_name(tag: str) -> str:
  return tag.rsplit("}", 1)[-1].lower()


def first_text(node: ET.Element, names: set[str]) -> str:
  for child in list(node):
    if local_name(child.tag) in names and child.text:
      return child.text.strip()
  return ""


def first_link(node: ET.Element) -> str:
  for child in list(node):
    if local_name(child.tag) != "link":
      continue
    href = child.attrib.get("href", "").strip()
    if href:
      return href
    if child.text:
      return child.text.strip()
  return ""


def parse_date(value: str | None) -> str | None:
  if not value:
    return None
  value = value.strip()
  try:
    if value.endswith("Z"):
      return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat()
  except ValueError:
    pass
  try:
    return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
  except (TypeError, ValueError, IndexError, AttributeError):
    return None


def parse_feed(xml_bytes: bytes) -> list[dict[str, Any]]:
  root = ET.fromstring(xml_bytes)
  items = root.findall("./channel/item")
  if not items and local_name(root.tag) == "feed":
    items = [child for child in list(root) if local_name(child.tag) == "entry"]

  parsed: list[dict[str, Any]] = []
  for item in items:
    title = first_text(item, {"title"})
    link = first_link(item)
    guid = first_text(item, {"guid", "id"})
    summary = first_text(item, {"description", "summary", "subtitle"})
    content = first_text(item, {"encoded", "content"})
    published = first_text(item, {"pubdate", "published", "updated", "date"})
    if not title or not (link or guid):
      continue
    parsed.append({
      "title": strip_html(title),
      "url": link or guid,
      "summary": strip_html(summary),
      "content": strip_html(content or summary),
      "html": content or summary,
      "published_at": parse_date(published),
      "raw": {
        "guid": guid,
        "published": published,
      },
    })
  return parsed


def article_hash(title: str, url: str, content: str) -> str:
  digest = hashlib.sha256()
  digest.update(title.strip().lower().encode("utf-8"))
  digest.update(b"\n")
  digest.update(url.strip().lower().encode("utf-8"))
  digest.update(b"\n")
  digest.update(content[:500].strip().lower().encode("utf-8"))
  return digest.hexdigest()


def fetch_feed(url: str, timeout: int) -> bytes:
  request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
  with urllib.request.urlopen(request, timeout=timeout) as response:
    return response.read()


def collect(db_path: Path, limit_sources: int | None, timeout: int) -> tuple[int, int]:
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)

    query = """
      SELECT id, name, category, rss_url
      FROM rss_sources
      WHERE is_active = 1
        AND rss_url IS NOT NULL
        AND availability IN ('verified', 'needs_verification', 'unknown')
      ORDER BY id ASC
    """
    sources = conn.execute(query).fetchall()
    if limit_sources:
      sources = sources[:limit_sources]

    run = conn.execute(
      "INSERT INTO workflow_runs (run_type, status, input_count) VALUES (?, ?, ?)",
      ("collect_rss_articles", "running", len(sources)),
    )
    run_id = run.lastrowid
    inserted = 0
    errors: list[str] = []

    for source in sources:
      try:
        feed = fetch_feed(source["rss_url"], timeout=timeout)
        items = parse_feed(feed)
      except Exception as exc:  # noqa: BLE001 - record per-source failures and continue.
        errors.append(f"{source['name']}: {exc}")
        continue

      for item in items:
        digest = article_hash(item["title"], item["url"], item["content"])
        cursor = conn.execute(
          """
          INSERT INTO ai_news_articles (
            hash, source_id, source_name, source_category, title, url, canonical_url,
            summary, content, html, published_at, status, raw_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'collected', ?)
          ON CONFLICT(hash) DO NOTHING
          """,
          (
            digest,
            source["id"],
            source["name"],
            source["category"],
            item["title"],
            item["url"],
            item["url"],
            item["summary"],
            item["content"],
            item["html"],
            item["published_at"],
            json.dumps(item["raw"], ensure_ascii=False),
          ),
        )
        inserted += cursor.rowcount

    conn.execute(
      """
      UPDATE workflow_runs
      SET status = ?, finished_at = CURRENT_TIMESTAMP, output_count = ?, notes = ?
      WHERE id = ?
      """,
      ("finished_with_errors" if errors else "finished", inserted, "\n".join(errors[:20]), run_id),
    )
    conn.commit()

  return len(sources), inserted


def main() -> None:
  parser = argparse.ArgumentParser(description="Collect RSS/Atom articles into SQLite.")
  parser.add_argument("--db", type=Path, default=DEFAULT_DB)
  parser.add_argument("--limit-sources", type=int)
  parser.add_argument("--timeout", type=int, default=15)
  args = parser.parse_args()

  source_count, article_count = collect(args.db, args.limit_sources, args.timeout)
  print(f"Checked {source_count} sources and inserted {article_count} new articles into {args.db}")


if __name__ == "__main__":
  main()
