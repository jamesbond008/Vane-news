#!/usr/bin/env python3
"""Screen recent AI news with Gemini and write selected memos into SQLite."""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "vane_news.sqlite"
DEFAULT_SCHEMA = ROOT / "database" / "schema.sql"
DEFAULT_PROMPT = ROOT / "docs" / "SUNDAY_VENTURE_FILTER_PROMPT.md"
DEFAULT_MODEL = "gemini-2.5-flash"
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


@dataclass(frozen=True)
class Candidate:
  article_id: int
  title: str
  source_name: str
  source_category: str
  url: str
  summary: str
  content: str
  published_at: str
  collected_at: str


@dataclass(frozen=True)
class Selection:
  article_id: int
  score: int
  front_category: str
  signal_level: str
  title: str
  tags: list[str]
  feynman_note: str
  why_now: str
  non_consensus: str
  edge: str
  actionable_advice: str
  reason: str

  @property
  def memo(self) -> str:
    today = datetime.now().strftime("%Y-%m-%d")
    tag_text = " / ".join(self.tags) if self.tags else self.front_category
    icon = "🎯" if self.score >= 80 else "📡"
    heading = "战略雷达" if self.score >= 80 else "观察名单"
    return (
      f"{icon} {heading} - {today}\n\n"
      f"{self.title} | {self.score}/100 | {self.signal_level}\n\n"
      f"🏷️ 标签：{tag_text}\n\n"
      f"一句判断：\n{self.feynman_note}\n\n"
      f"为什么现在：\n{self.why_now}\n\n"
      f"非共识视角：\n{self.non_consensus}\n\n"
      f"破局点：\n{self.edge}\n\n"
      f"行动建议：\n{self.actionable_advice}\n\n"
      f"入选理由：\n{self.reason}"
    )


def ensure_schema(conn: sqlite3.Connection) -> None:
  conn.executescript(DEFAULT_SCHEMA.read_text(encoding="utf-8"))


def parse_env_file(path: Path) -> None:
  if not path.exists():
    return
  for raw_line in path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
      continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip().strip("'\"")
    if key and key not in os.environ:
      os.environ[key] = value


def load_local_env() -> None:
  parse_env_file(ROOT / ".env.local")
  parse_env_file(ROOT / ".env")


def strip_html(value: str | None) -> str:
  if not value:
    return ""
  text = re.sub(r"<[^>]+>", " ", value)
  return re.sub(r"\s+", " ", text).strip()


def truncate(value: str | None, limit: int) -> str:
  text = strip_html(value)
  if len(text) <= limit:
    return text
  return text[:limit - 1].rstrip() + "…"


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


def is_recent(collected_at: str, fresh_hours: int) -> bool:
  parsed = parse_timestamp(collected_at)
  if parsed is None:
    return True
  return parsed >= datetime.now(timezone.utc) - timedelta(hours=fresh_hours)


def ensure_prompt_version(conn: sqlite3.Connection, prompt_path: Path, model: str) -> int:
  relative = prompt_path.relative_to(ROOT) if prompt_path.is_relative_to(ROOT) else prompt_path
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
      "sunday-venture-gemini-v3",
      str(relative),
      "Gemini screening for Sunday Venture Studio AI intelligence feed",
      f"Model={model}; v3 prompt; threshold is enforced in prompt and script.",
    ),
  )
  row = conn.execute(
    "SELECT id FROM prompt_versions WHERE version = ?",
    ("sunday-venture-gemini-v3",),
  ).fetchone()
  return int(row[0])


def fetch_candidates(conn: sqlite3.Connection, limit: int, fresh_hours: int) -> list[Candidate]:
  rows = conn.execute(
    """
    SELECT id, title, source_name, source_category, url, summary, content, html, published_at, collected_at
    FROM ai_news_articles
    WHERE status IN ('collected', 'selected', 'published')
    ORDER BY COALESCE(published_at, collected_at) DESC, id DESC
    LIMIT ?
    """,
    (limit,),
  ).fetchall()
  candidates: list[Candidate] = []
  for row in rows:
    collected_at = row["collected_at"] or ""
    if not is_recent(collected_at, fresh_hours):
      continue
    candidates.append(Candidate(
      article_id=int(row["id"]),
      title=row["title"] or "",
      source_name=row["source_name"] or "",
      source_category=row["source_category"] or "",
      url=row["url"] or "",
      summary=row["summary"] or "",
      content=row["content"] or row["html"] or "",
      published_at=row["published_at"] or "",
      collected_at=collected_at,
    ))
  return candidates


def response_schema() -> dict[str, Any]:
  return {
    "type": "ARRAY",
    "items": {
      "type": "OBJECT",
      "properties": {
        "article_id": {"type": "INTEGER"},
        "score": {"type": "INTEGER"},
        "front_category": {
          "type": "STRING",
          "enum": ["Investment", "GitHub", "News", "Minds", "Research"],
        },
        "signal_level": {
          "type": "STRING",
          "enum": ["Strategic Radar", "Watchlist", "Context Signal"],
        },
        "title": {"type": "STRING"},
        "tags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "feynman_note": {"type": "STRING"},
        "why_now": {"type": "STRING"},
        "non_consensus": {"type": "STRING"},
        "edge": {"type": "STRING"},
        "actionable_advice": {"type": "STRING"},
        "reason": {"type": "STRING"},
      },
      "required": [
        "article_id",
        "score",
        "front_category",
        "signal_level",
        "title",
        "tags",
        "feynman_note",
        "why_now",
        "non_consensus",
        "edge",
        "actionable_advice",
        "reason",
      ],
    },
  }


def candidate_payload(candidates: list[Candidate]) -> list[dict[str, Any]]:
  return [{
    "article_id": item.article_id,
    "title": truncate(item.title, 240),
    "source": truncate(item.source_name, 120),
    "source_category": truncate(item.source_category, 80),
    "url": item.url,
    "summary": truncate(item.summary, 900),
    "content": truncate(item.content, 1800),
    "published_at": item.published_at,
    "collected_at": item.collected_at,
  } for item in candidates]


def build_user_prompt(candidates: list[Candidate], min_score: int, max_selected: int) -> str:
  return (
    "请筛选下面这批候选新闻。只输出 JSON，不要输出 Markdown。\n"
    f"硬规则：只保留综合评分 >= {min_score} 的新闻；如果没有达标项，输出 []。\n"
    f"本批优先输出 2-6 条，整轮最多输出 {max_selected} 条。score 必须是 0-100 的整数。\n"
    "front_category 只能是 Investment、GitHub、News、Minds、Research 之一。\n"
    "signal_level 只能是 Strategic Radar、Watchlist、Context Signal 之一。\n"
    "title 请改写成信号标题，不要机械复制原标题。\n"
    "feynman_note、why_now、non_consensus、edge、actionable_advice 都必须短、具体、可执行。\n"
    "actionable_advice 必须包含谁、做什么、时间窗口。\n\n"
    f"候选新闻 JSON：\n{json.dumps(candidate_payload(candidates), ensure_ascii=False, indent=2)}"
  )


def extract_response_text(payload: dict[str, Any]) -> str:
  candidates = payload.get("candidates") or []
  if not candidates:
    feedback = payload.get("promptFeedback") or payload.get("prompt_feedback") or {}
    raise RuntimeError(f"Gemini returned no candidates. Feedback: {feedback}")
  parts = candidates[0].get("content", {}).get("parts", [])
  text = "".join(str(part.get("text", "")) for part in parts)
  if not text.strip():
    raise RuntimeError("Gemini returned an empty response.")
  return text


def parse_selections(text: str, allowed_ids: set[int], min_score: int) -> list[Selection]:
  try:
    raw = json.loads(text)
  except json.JSONDecodeError:
    match = re.search(r"\[[\s\S]*\]", text)
    if not match:
      raise
    raw = json.loads(match.group(0))

  if not isinstance(raw, list):
    raise ValueError("Gemini response must be a JSON array.")

  selections: list[Selection] = []
  for item in raw:
    if not isinstance(item, dict):
      continue
    try:
      article_id = int(item["article_id"])
      score = int(item["score"])
    except (KeyError, TypeError, ValueError):
      continue
    if article_id not in allowed_ids or score < min_score:
      continue
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    signal_level = str(item.get("signal_level") or "").strip()
    if not signal_level:
      signal_level = "Strategic Radar" if score >= 80 else "Watchlist" if score >= 60 else "Context Signal"
    selections.append(Selection(
      article_id=article_id,
      score=max(0, min(score, 100)),
      front_category=str(item.get("front_category") or "News"),
      signal_level=signal_level,
      title=str(item.get("title") or f"Article {article_id}")[:140],
      tags=[str(tag)[:40] for tag in tags if tag][:6],
      feynman_note=str(item.get("feynman_note") or "").strip(),
      why_now=str(item.get("why_now") or "").strip(),
      non_consensus=str(item.get("non_consensus") or "").strip(),
      edge=str(item.get("edge") or "").strip(),
      actionable_advice=str(item.get("actionable_advice") or "").strip(),
      reason=str(item.get("reason") or "").strip(),
    ))
  return selections


def call_gemini(
  api_key: str,
  model: str,
  system_prompt: str,
  user_prompt: str,
  timeout: int,
  retries: int,
) -> dict[str, Any]:
  url = API_URL.format(model=urllib.parse.quote(model, safe=""))
  body = {
    "systemInstruction": {"parts": [{"text": system_prompt}]},
    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
    "generationConfig": {
      "temperature": 0.15,
      "responseMimeType": "application/json",
      "responseSchema": response_schema(),
    },
  }
  data = json.dumps(body).encode("utf-8")
  request = urllib.request.Request(
    url,
    data=data,
    method="POST",
    headers={
      "Content-Type": "application/json",
      "x-goog-api-key": api_key,
    },
  )

  last_error: Exception | None = None
  for attempt in range(retries + 1):
    try:
      with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
      body_text = exc.read().decode("utf-8", errors="replace")
      last_error = RuntimeError(f"Gemini HTTP {exc.code}: {body_text[:800]}")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
      last_error = exc
    if attempt < retries:
      time.sleep(1.5 * (attempt + 1))
  raise RuntimeError(f"Gemini request failed: {last_error}")


def replace_selected_news(
  conn: sqlite3.Connection,
  run_id: int,
  prompt_version_id: int,
  selections: list[Selection],
  clear_previous: bool,
) -> None:
  if clear_previous:
    conn.execute("DELETE FROM selected_news")
    conn.execute(
      """
      UPDATE ai_news_articles
      SET status = 'collected', score = NULL, screening_reason = NULL
      WHERE status = 'selected'
      """
    )

  for rank, item in enumerate(selections, start=1):
    conn.execute(
      """
      INSERT INTO selected_news (
        run_id, article_id, prompt_version_id, selected_rank, front_category,
        score, editorial_summary, reason, tags_json, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'selected')
      """,
      (
        run_id,
        item.article_id,
        prompt_version_id,
        rank,
        item.front_category,
        item.score,
        item.memo,
        item.reason or item.edge,
        json.dumps(item.tags, ensure_ascii=False),
      ),
    )
    conn.execute(
      """
      UPDATE ai_news_articles
      SET status = 'selected', score = ?, screening_reason = ?, tags_json = ?
      WHERE id = ?
      """,
      (
        item.score,
        item.reason or item.edge,
        json.dumps(item.tags, ensure_ascii=False),
        item.article_id,
      ),
    )


def run_screen(
  db_path: Path,
  prompt_path: Path,
  model: str,
  limit_candidates: int,
  batch_size: int,
  max_selected: int,
  min_score: int,
  fresh_hours: int,
  clear_previous: bool,
  timeout: int,
  retries: int,
) -> tuple[int, int]:
  load_local_env()
  api_key = os.environ.get("GEMINI_API_KEY", "").strip()
  if not api_key or api_key == "MY_GEMINI_API_KEY":
    raise RuntimeError("Missing GEMINI_API_KEY. Put it in .env.local or export it before running.")

  system_prompt = prompt_path.read_text(encoding="utf-8")
  all_selections: dict[int, Selection] = {}

  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)
    prompt_version_id = ensure_prompt_version(conn, prompt_path, model)
    candidates = fetch_candidates(conn, limit_candidates, fresh_hours)
    run = conn.execute(
      "INSERT INTO workflow_runs (run_type, status, input_count, notes) VALUES (?, ?, ?, ?)",
      (
        "screen_with_gemini",
        "running",
        len(candidates),
        f"model={model}; min_score={min_score}; fresh_hours={fresh_hours}",
      ),
    )
    run_id = int(run.lastrowid)

    try:
      if candidates:
        for index in range(0, len(candidates), batch_size):
          batch = candidates[index:index + batch_size]
          user_prompt = build_user_prompt(batch, min_score, max_selected)
          response = call_gemini(api_key, model, system_prompt, user_prompt, timeout, retries)
          selections = parse_selections(
            extract_response_text(response),
            {item.article_id for item in batch},
            min_score,
          )
          for selection in selections:
            existing = all_selections.get(selection.article_id)
            if existing is None or selection.score > existing.score:
              all_selections[selection.article_id] = selection

      selected = sorted(
        all_selections.values(),
        key=lambda item: (-item.score, item.article_id),
      )[:max_selected]
      replace_selected_news(conn, run_id, prompt_version_id, selected, clear_previous)
      conn.execute(
        """
        UPDATE workflow_runs
        SET status = 'finished', finished_at = CURRENT_TIMESTAMP, output_count = ?
        WHERE id = ?
        """,
        (len(selected), run_id),
      )
      conn.commit()
      return len(candidates), len(selected)
    except Exception as exc:
      conn.execute(
        """
        UPDATE workflow_runs
        SET status = 'failed', finished_at = CURRENT_TIMESTAMP, notes = ?
        WHERE id = ?
        """,
        (str(exc)[:1000], run_id),
      )
      conn.commit()
      raise


def main() -> None:
  parser = argparse.ArgumentParser(description="Screen fresh AI news with Gemini.")
  parser.add_argument("--db", type=Path, default=DEFAULT_DB)
  parser.add_argument("--prompt", type=Path, default=DEFAULT_PROMPT)
  parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL))
  parser.add_argument("--limit-candidates", type=int, default=120)
  parser.add_argument("--batch-size", type=int, default=20)
  parser.add_argument("--max-selected", type=int, default=12)
  parser.add_argument("--min-score", type=int, default=50)
  parser.add_argument("--fresh-hours", type=int, default=24)
  parser.add_argument("--keep-previous", action="store_true")
  parser.add_argument("--timeout", type=int, default=90)
  parser.add_argument("--retries", type=int, default=2)
  args = parser.parse_args()

  candidate_count, selected_count = run_screen(
    db_path=args.db,
    prompt_path=args.prompt,
    model=args.model,
    limit_candidates=args.limit_candidates,
    batch_size=max(1, args.batch_size),
    max_selected=max(1, args.max_selected),
    min_score=args.min_score,
    fresh_hours=args.fresh_hours,
    clear_previous=not args.keep_previous,
    timeout=args.timeout,
    retries=args.retries,
  )
  print(f"Gemini screened {candidate_count} fresh candidates and selected {selected_count} articles.")


if __name__ == "__main__":
  main()
