#!/usr/bin/env python3
"""Export selected news records from SQLite into the React frontend data file."""

from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "vane_news.sqlite"
DEFAULT_OUT = ROOT / "src" / "data" / "generatedArticles.ts"

FRONT_CATEGORIES = {"Investment", "GitHub", "News", "Minds", "Research"}


def front_category(value: str | None) -> str:
  text = value or ""
  if text in FRONT_CATEGORIES:
    return text
  if "学术" in text or "论文" in text or "研究" in text or "技术/研究" in text:
    return "Research"
  if "社区" in text or "通讯" in text or "博客" in text:
    return "Minds"
  if "工具" in text or "聚合" in text or "GitHub" in text:
    return "GitHub"
  if "投资" in text or "创业" in text or "融资" in text:
    return "Investment"
  return "News"


def strip_tags(value: str | None) -> str:
  if not value:
    return ""
  text = re.sub(r"<[^>]+>", " ", value)
  text = html.unescape(text)
  return re.sub(r"\s+", " ", text).strip()


def short_text(value: str, limit: int = 180) -> str:
  if len(value) <= limit:
    return value
  return value[: limit - 1].rstrip() + "..."


def parse_json_list(value: str | None) -> list[str]:
  if not value:
    return []
  try:
    parsed = json.loads(value)
  except json.JSONDecodeError:
    return []
  return [str(item) for item in parsed if item]


def estimate_read_time(content: str) -> str:
  words = max(1, len(strip_tags(content)) // 500)
  return f"{max(1, min(words, 12))} min"


def date_only(value: str | None) -> str:
  if not value:
    return datetime.now().strftime("%Y-%m-%d")
  return value[:10]


def memo_title(value: str | None, fallback: str) -> str:
  if not value:
    return fallback
  for raw_line in value.splitlines():
    line = strip_tags(raw_line).strip()
    if not line or "|" not in line:
      continue
    if re.search(r"\b\d{2,3}/100\b", line):
      title = line.split("|", 1)[0].strip()
      if title:
        return title
  return fallback


def article_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
  selected = conn.execute(
    """
    SELECT
      a.id,
      a.title,
      a.url,
      a.summary,
      a.content,
      a.html,
      a.published_at,
      a.source_name,
      a.source_category,
      a.tags_json AS article_tags,
      s.front_category,
      s.editorial_summary,
      s.tags_json AS selection_tags,
      s.selected_rank
    FROM selected_news s
    JOIN ai_news_articles a ON a.id = s.article_id
    WHERE s.status IN ('selected', 'published')
    ORDER BY s.selected_rank ASC, a.published_at DESC
    """
  ).fetchall()
  if selected:
    return selected

  return conn.execute(
    """
    SELECT
      id,
      title,
      url,
      summary,
      content,
      html,
      published_at,
      source_name,
      source_category,
      tags_json AS article_tags,
      NULL AS front_category,
      NULL AS editorial_summary,
      NULL AS selection_tags,
      id AS selected_rank
    FROM ai_news_articles
    WHERE status IN ('collected', 'selected', 'published')
    ORDER BY published_at DESC, collected_at DESC
    LIMIT 120
    """
  ).fetchall()


def source_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
  return conn.execute(
    """
    SELECT
      id,
      name,
      category,
      website_url,
      rss_url,
      rss_candidates_json,
      availability,
      status_note,
      content_focus,
      fallback_plan,
      requires_special_handling
    FROM rss_sources
    WHERE is_active = 1
    ORDER BY id ASC
    """
  ).fetchall()


def articles_from_news(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
  articles: list[dict[str, Any]] = []
  for row in rows:
    raw_content = row["html"] or row["content"] or row["summary"] or ""
    plain = strip_tags(row["editorial_summary"] or row["summary"] or row["content"] or raw_content)
    tags = parse_json_list(row["selection_tags"]) or parse_json_list(row["article_tags"])
    source_name = row["source_name"] or "VANE News"
    memo = row["editorial_summary"] or ""
    display_title = memo_title(memo, row["title"])
    if memo:
      memo_html = "".join(f"<p>{html.escape(part)}</p>" for part in memo.split("\n\n") if part.strip())
      raw_plain = strip_tags(raw_content)
      content = (
        f"<h2>Sunday Venture Studio Memo</h2>{memo_html}"
        f"<h2>Source Context</h2><p>{html.escape(short_text(raw_plain, 900))}</p>"
      )
    else:
      content = raw_content if "<" in raw_content else f"<p>{html.escape(raw_content or plain)}</p>"
    articles.append({
      "id": f"news-{row['id']}",
      "category": front_category(row["front_category"] or row["source_category"]),
      "title": display_title,
      "excerpt": short_text(plain or f"来自 {source_name} 的候选新闻。"),
      "content": content,
      "date": date_only(row["published_at"]),
      "author": source_name,
      "tags": tags[:6] or [front_category(row["source_category"]), source_name],
      "readTime": estimate_read_time(raw_content or plain),
      "sourceName": source_name,
      "sourceUrl": row["url"] or "",
    })
  return articles


def articles_from_sources(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
  articles: list[dict[str, Any]] = []
  today = datetime.now().strftime("%Y-%m-%d")
  for row in rows:
    candidates = parse_json_list(row["rss_candidates_json"])
    rss_markup = "".join(f"<li><a href=\"{html.escape(url)}\">{html.escape(url)}</a></li>" for url in candidates)
    if not rss_markup:
      rss_markup = "<li>暂未记录标准 RSS，后续可接 API、网页抓取或 RSSHub。</li>"
    handling = "需要特殊处理" if row["requires_special_handling"] else "可直接进入 RSS 采集"
    content_focus = row["content_focus"] or "待补充内容定位"
    articles.append({
      "id": f"source-{row['id']}",
      "category": front_category(row["category"]),
      "title": row["name"],
      "excerpt": short_text(f"{row['category']} / {content_focus} / {handling}"),
      "content": (
        f"<p><strong>内容定位：</strong>{html.escape(content_focus)}</p>"
        f"<p><strong>采集状态：</strong>{html.escape(row['availability'] or 'unknown')} "
        f"{html.escape(row['status_note'] or '')}</p>"
        f"<p><strong>网站：</strong><a href=\"{html.escape(row['website_url'] or '')}\">{html.escape(row['website_url'] or '')}</a></p>"
        f"<h2>RSS 候选</h2><ul>{rss_markup}</ul>"
        f"<p><strong>备用方案：</strong>{html.escape(row['fallback_plan'] or '暂无')}</p>"
      ),
      "date": today,
      "author": "VANE Source Registry",
      "tags": [front_category(row["category"]), row["availability"], "RSS"],
      "readTime": "1 min",
      "sourceName": row["name"],
      "sourceUrl": row["website_url"] or row["rss_url"] or "",
    })
  return articles


def export_articles(db_path: Path, out_path: Path) -> int:
  out_path.parent.mkdir(parents=True, exist_ok=True)
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    news = article_rows(conn)
    articles = articles_from_news(news)

  body = json.dumps(articles, ensure_ascii=False, indent=2)
  out_path.write_text(
    "/* Generated by scripts/export_frontend_news.py. Do not edit by hand. */\n"
    "import type { Article } from '../types';\n\n"
    f"export const GENERATED_ARTICLES: Article[] = {body};\n",
    encoding="utf-8",
  )
  return len(articles)


def main() -> None:
  parser = argparse.ArgumentParser(description="Export database news into React data.")
  parser.add_argument("--db", type=Path, default=DEFAULT_DB)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args()

  count = export_articles(args.db, args.out)
  print(f"Exported {count} frontend articles into {args.out}")


if __name__ == "__main__":
  main()
