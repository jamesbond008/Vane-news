#!/usr/bin/env python3
"""Delete collected news records after a configurable TTL."""

from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "vane_news.sqlite"
DEFAULT_SCHEMA = ROOT / "database" / "schema.sql"


def ensure_schema(conn: sqlite3.Connection) -> None:
  conn.executescript(DEFAULT_SCHEMA.read_text(encoding="utf-8"))


def parse_timestamp(value: str | None) -> datetime | None:
  if not value:
    return None
  text = value.strip()
  try:
    if text.endswith("Z"):
      text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
  except ValueError:
    try:
      parsed = datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
    except ValueError:
      return None
  if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=timezone.utc)
  return parsed.astimezone(timezone.utc)


def chunked(values: list[int], size: int = 500) -> list[list[int]]:
  return [values[index:index + size] for index in range(0, len(values), size)]


def cleanup(db_path: Path, hours: int, dry_run: bool) -> tuple[int, int]:
  cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)

    run = conn.execute(
      "INSERT INTO workflow_runs (run_type, status, notes) VALUES (?, ?, ?)",
      ("cleanup_old_news", "running", f"TTL hours={hours}; dry_run={dry_run}"),
    )
    run_id = int(run.lastrowid)

    rows = conn.execute(
      "SELECT id, collected_at FROM ai_news_articles ORDER BY id ASC"
    ).fetchall()
    expired_ids = [
      int(row["id"])
      for row in rows
      if (parse_timestamp(row["collected_at"]) or datetime.min.replace(tzinfo=timezone.utc)) < cutoff
    ]

    selected_deleted = 0
    if expired_ids and not dry_run:
      for batch in chunked(expired_ids):
        placeholders = ",".join("?" for _ in batch)
        selected_deleted += conn.execute(
          f"DELETE FROM selected_news WHERE article_id IN ({placeholders})",
          batch,
        ).rowcount
        conn.execute(
          f"DELETE FROM ai_news_articles WHERE id IN ({placeholders})",
          batch,
        )

    status = "dry_run" if dry_run else "finished"
    conn.execute(
      """
      UPDATE workflow_runs
      SET status = ?, finished_at = CURRENT_TIMESTAMP, input_count = ?, output_count = ?, notes = ?
      WHERE id = ?
      """,
      (
        status,
        len(rows),
        len(expired_ids),
        f"Deleted {len(expired_ids)} articles and {selected_deleted} selected rows older than {hours}h.",
        run_id,
      ),
    )
    conn.commit()

  return len(expired_ids), selected_deleted


def main() -> None:
  parser = argparse.ArgumentParser(description="Remove collected news older than a TTL.")
  parser.add_argument("--db", type=Path, default=DEFAULT_DB)
  parser.add_argument("--hours", type=int, default=24)
  parser.add_argument("--dry-run", action="store_true")
  args = parser.parse_args()

  article_count, selected_count = cleanup(args.db, args.hours, args.dry_run)
  verb = "Would delete" if args.dry_run else "Deleted"
  print(f"{verb} {article_count} articles and {selected_count} selected rows older than {args.hours}h.")


if __name__ == "__main__":
  main()
