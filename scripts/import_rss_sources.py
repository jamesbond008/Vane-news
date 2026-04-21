#!/usr/bin/env python3
"""Import the AI news RSS-source markdown catalog into the local SQLite database."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "vane_news.sqlite"
DEFAULT_SCHEMA = ROOT / "database" / "schema.sql"
DEFAULT_MD = Path("/Users/james007/Desktop/新闻工作流/ai新闻工作流制作/AI新闻工作流_RSS源汇总.md")


@dataclass
class RssSource:
  name: str
  category: str
  website_url: str = ""
  rss_candidates: list[str] = field(default_factory=list)
  availability: str = "unknown"
  status_note: str = ""
  content_focus: str = ""
  fallback_plan: str = ""
  requires_special_handling: int = 0

  @property
  def rss_url(self) -> str | None:
    return self.rss_candidates[0] if self.rss_candidates else None


def clean_heading(value: str) -> str:
  value = re.sub(r"^[#\s]+", "", value).strip()
  value = re.sub(r"^[^\w\u4e00-\u9fff]+", "", value).strip()
  return value


def clean_value(value: str) -> str:
  value = value.strip()
  value = value.replace("`", "")
  value = value.replace("**", "")
  return value.strip()


def extract_urls(value: str) -> list[str]:
  urls = re.findall(r"https?://[^\s`，,、）)]+", value)
  return [url.rstrip(".。") for url in urls]


def infer_availability(raw: str) -> str:
  if "无标准 RSS" in raw or "Newsletter 为主" in raw:
    return "no_standard_rss"
  if "✅" in raw or "可用" in raw:
    return "verified"
  if "⚠️" in raw or "需验证" in raw or "可能" in raw or "返回 HTML" in raw:
    return "needs_verification"
  if "API" in raw or "网页抓取" in raw or "爬虫" in raw:
    return "special_handling"
  return "unknown"


def needs_special_handling(raw: str) -> int:
  signals = ["需验证", "返回 HTML", "无标准 RSS", "Newsletter", "API", "网页抓取", "爬虫", "User-Agent"]
  return int(any(signal in raw for signal in signals))


def parse_sources(markdown: str) -> list[RssSource]:
  sources: list[RssSource] = []
  current_category = ""
  current: RssSource | None = None
  in_sources_section = False

  def flush_current() -> None:
    nonlocal current
    if current:
      raw = " ".join([
        current.status_note,
        current.fallback_plan,
        current.content_focus,
        " ".join(current.rss_candidates),
      ])
      if current.availability == "unknown":
        current.availability = infer_availability(raw)
      current.requires_special_handling = needs_special_handling(raw)
      sources.append(current)
    current = None

  for line in markdown.splitlines():
    stripped = line.strip()
    if stripped.startswith("## 3."):
      in_sources_section = True
      continue
    if in_sources_section and stripped.startswith("## 4."):
      flush_current()
      break
    if not in_sources_section:
      continue

    if stripped.startswith("### "):
      flush_current()
      current_category = clean_heading(stripped)
      continue

    if stripped.startswith("#### "):
      flush_current()
      current = RssSource(name=clean_heading(stripped), category=current_category)
      continue

    if not current or not stripped.startswith("- **"):
      continue

    match = re.match(r"- \*\*(.+?)\*\*[:：](.*)", stripped)
    if not match:
      continue

    key = match.group(1).strip()
    value = clean_value(match.group(2))
    urls = extract_urls(value)

    if key == "网站":
      current.website_url = urls[0] if urls else value
    elif key == "RSS 订阅源":
      current.rss_candidates = urls
      current.status_note = value if "⚠️" in value or "无标准 RSS" in value or "Newsletter" in value else current.status_note
      current.availability = infer_availability(value)
    elif key == "状态":
      current.status_note = value
      current.availability = infer_availability(value)
    elif key == "备用方案":
      current.fallback_plan = value
    elif key == "内容":
      current.content_focus = value

  return sources


def init_db(conn: sqlite3.Connection, schema_path: Path) -> None:
  conn.executescript(schema_path.read_text(encoding="utf-8"))
  conn.execute(
    """
    INSERT INTO prompt_versions (version, prompt_path, purpose, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(version) DO UPDATE SET
      prompt_path = excluded.prompt_path,
      purpose = excluded.purpose,
      notes = excluded.notes
    """,
    (
      "v1-rss-screening",
      "docs/AI_NEWS_SYSTEM_PROMPT.md",
      "筛选、去重、分级并输出可进入 VANE 前端的信息流新闻",
      "Seeded by scripts/import_rss_sources.py",
    ),
  )


def import_sources(markdown_path: Path, db_path: Path, schema_path: Path) -> int:
  markdown = markdown_path.read_text(encoding="utf-8")
  sources = parse_sources(markdown)
  db_path.parent.mkdir(parents=True, exist_ok=True)

  with sqlite3.connect(db_path) as conn:
    init_db(conn, schema_path)
    run = conn.execute(
      "INSERT INTO workflow_runs (run_type, status, input_count, notes) VALUES (?, ?, ?, ?)",
      ("import_rss_sources", "running", len(sources), str(markdown_path)),
    )
    run_id = run.lastrowid

    for source in sources:
      conn.execute(
        """
        INSERT INTO rss_sources (
          name, category, website_url, rss_url, rss_candidates_json, availability,
          status_note, content_focus, fallback_plan, requires_special_handling,
          is_active, source_markdown_path, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(name, website_url) DO UPDATE SET
          category = excluded.category,
          rss_url = excluded.rss_url,
          rss_candidates_json = excluded.rss_candidates_json,
          availability = excluded.availability,
          status_note = excluded.status_note,
          content_focus = excluded.content_focus,
          fallback_plan = excluded.fallback_plan,
          requires_special_handling = excluded.requires_special_handling,
          is_active = excluded.is_active,
          source_markdown_path = excluded.source_markdown_path,
          updated_at = CURRENT_TIMESTAMP
        """,
        (
          source.name,
          source.category,
          source.website_url,
          source.rss_url,
          json.dumps(source.rss_candidates, ensure_ascii=False),
          source.availability,
          source.status_note,
          source.content_focus,
          source.fallback_plan,
          source.requires_special_handling,
          str(markdown_path),
        ),
      )

    conn.execute(
      "UPDATE workflow_runs SET status = ?, finished_at = CURRENT_TIMESTAMP, output_count = ? WHERE id = ?",
      ("finished", len(sources), run_id),
    )
    conn.commit()

  return len(sources)


def main() -> None:
  parser = argparse.ArgumentParser(description="Import RSS source markdown into SQLite.")
  parser.add_argument("markdown", nargs="?", type=Path, default=DEFAULT_MD)
  parser.add_argument("--db", type=Path, default=DEFAULT_DB)
  parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
  args = parser.parse_args()

  count = import_sources(args.markdown, args.db, args.schema)
  print(f"Imported {count} RSS sources into {args.db}")


if __name__ == "__main__":
  main()
