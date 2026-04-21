#!/usr/bin/env python3
"""Screen candidate AI news with the Sunday Venture Studio scoring matrix."""

from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "data" / "vane_news.sqlite"
PROMPT_PATH = ROOT / "docs" / "SUNDAY_VENTURE_FILTER_PROMPT.md"


@dataclass(frozen=True)
class DimensionScore:
  score: int
  label: str
  reason: str


@dataclass(frozen=True)
class ScreenedArticle:
  article_id: int
  score: int
  front_category: str
  summary: str
  reason: str
  tags: list[str]


def normalize(value: str | None) -> str:
  if not value:
    return ""
  text = re.sub(r"<[^>]+>", " ", value)
  text = html.unescape(text)
  return re.sub(r"\s+", " ", text).strip()


def contains_any(text: str, terms: list[str]) -> bool:
  lower = text.lower()
  return any(term.lower() in lower for term in terms)


def title_entity(title: str) -> str:
  cleaned = re.sub(r"[\[\(].*?[\]\)]", "", title).strip()
  parts = re.split(r"[:：|,-]", cleaned, maxsplit=1)
  return parts[0].strip()[:80] or cleaned[:80]


def score_investment(text: str, source: str) -> DimensionScore:
  top_investors = ["a16z", "andreessen", "sequoia", "benchmark", "thrive", "founders fund", "lightspeed", "greylock"]
  giants = ["openai", "anthropic", "google", "deepmind", "meta", "microsoft", "nvidia", "amazon", "aws", "databricks", "snowflake"]
  infra = ["infrastructure", "infra", "compute", "gpu", "chip", "inference", "agent platform", "foundation model", "model provider", "data center"]
  deal = ["funding", "raises", "raised", "series", "led by", "acquires", "acquisition", "merger", "ipo", "领投", "融资", "并购", "收购", "上市"]
  vertical_action = ["system of action", "workflow automation", "agentic workflow", "vertical ai", "autonomous workflow", "行动系统"]

  if contains_any(text, deal) and (contains_any(text, top_investors) or (contains_any(text, giants) and contains_any(text, infra))):
    return DimensionScore(25, "顶级融资 / 巨头交易", "头部资本或巨头动作落在基础设施、算力层或 Agent 平台。")
  if contains_any(text, deal) and contains_any(text, vertical_action):
    return DimensionScore(10, "垂直行动系统融资", "垂直 System of Action 具备一定赛道信号。")
  if contains_any(text, ["ipo"]) and contains_any(text, ["cerebras", "gpu", "chip", "compute"]):
    return DimensionScore(25, "算力层资本事件", "算力层核心公司资本化，影响基础设施供给格局。")
  return DimensionScore(0, "资本信号不足", "没有足够强的资本或赛道重构信号。")


def score_engineering(text: str, source: str) -> DimensionScore:
  hard_agent_terms = [
    "long-horizon", "long horizon", "memory", "persistent memory", "tool use", "tool calling",
    "agent runtime", "agent framework", "multi-agent", "workflow agent", "browser agent",
    "retrieval", "rag", "reasoning cost", "inference cost", "open source", "github",
    "开源", "记忆", "工具调用", "智能体", "推理成本",
  ]
  release_terms = ["weights", "model weights", "dataset", "fine-tuning", "sft", "rlhf", "dpo", "benchmark", "数据集", "权重", "微调"]
  weak_ui = ["ui", "wrapper", "chatbot", "prompt pack", "template"]

  if contains_any(text, hard_agent_terms) and contains_any(text, ["sota", "state-of-the-art", "100% accuracy", "scale", "reliability", "framework", "runtime", "engine"]):
    return DimensionScore(25, "GitHub / 工程前沿", "命中长程记忆、工具调用、检索或推理成本这类 Agent 基础能力。")
  if contains_any(text, release_terms) and not contains_any(text, weak_ui):
    return DimensionScore(15, "权重 / 数据集发布", "模型权重、数据集或高质量训练材料有复用价值。")
  return DimensionScore(0, "工程信号不足", "更像应用层或泛资讯，未击中 Agent 基础设施。")


def score_titans(text: str, source: str) -> DimensionScore:
  top_people = [
    "ilya sutskever", "demis hassabis", "dario amodei", "andrej karpathy",
    "geoffrey hinton", "yann lecun", "noam brown", "john schulman",
  ]
  senior_roles = ["cto", "chief scientist", "research lead", "head of ai", "principal scientist", "technical lead", "首席科学家", "技术负责人"]
  signal_actions = ["paper", "interview", "leaves", "joins", "startup", "launches", "论文", "访谈", "离职", "创业"]

  if contains_any(text, top_people) and contains_any(text, signal_actions):
    return DimensionScore(25, "核心人物强信号", "顶尖研究者的论文、访谈或职业动向。")
  if contains_any(text, senior_roles) and contains_any(text, ["architecture", "engineering", "scaling", "inference", "agent", "架构", "工程实践"]):
    return DimensionScore(15, "核心技术负责人分享", "大厂核心技术负责人给出工程或架构实践。")
  return DimensionScore(0, "人物信号不足", "没有技术核心人物的强变化。")


def score_breakthrough(text: str, source: str) -> DimensionScore:
  breakthrough_terms = [
    "state space model", "ssm", "mamba", "linear attention", "test-time compute", "test time compute",
    "reasoning at inference", "inference-time reasoning", "world model", "neural architecture",
    "transformer bottleneck", "hallucination", "formal verification", "mechanistic interpretability",
    "状态空间", "推理期计算", "世界模型", "幻觉", "架构突破", "transformer 瓶颈",
  ]
  hard_claims = ["breakthrough", "new architecture", "orders of magnitude", "10x", "100x", "mathematical", "proof", "scale", "突破", "量级", "根本性"]
  weak_benchmark = ["leaderboard", "benchmark score", "1%", "slightly", "小幅"]

  if contains_any(text, breakthrough_terms) and contains_any(text, hard_claims) and not contains_any(text, weak_benchmark):
    return DimensionScore(25, "架构 / 范式突破", "命中 Transformer 瓶颈、推理期计算或幻觉治理等底层问题。")
  return DimensionScore(0, "范式突破不足", "没有底层架构或第一性原理级别突破。")


def front_category(scores: list[DimensionScore]) -> str:
  labels = " ".join(score.label for score in scores)
  if "融资" in labels or "资本" in labels:
    return "Investment"
  if "GitHub" in labels or "工程" in labels or "权重" in labels:
    return "GitHub"
  if "人物" in labels:
    return "Minds"
  if "架构" in labels or "范式" in labels:
    return "Research"
  return "News"


def feynman_note(title: str, scores: list[DimensionScore]) -> str:
  labels = " ".join(score.label for score in scores if score.score > 0)
  if "算力" in labels or "资本" in labels:
    return "这不是又一家 AI 公司融资，而是在重新分配下一代智能体的算力入口。"
  if "GitHub" in labels or "工程" in labels:
    return "这不是多一个工具，而是在给长程智能体补上更稳定的执行骨架。"
  if "人物" in labels:
    return "这不是公关露出，而是关键研究者在改变下一阶段技术叙事。"
  if "架构" in labels or "范式" in labels:
    return "这不是榜单涨一点，而是在尝试替换模型能力增长的底层发动机。"
  return "这条信息只有在能改变 Agent 能力边界时才值得进入雷达。"


def tags_for(scores: list[DimensionScore]) -> list[str]:
  tags: list[str] = []
  for item in scores:
    if item.score > 0:
      tags.append(item.label)
  return tags[:5]


def screen_row(row: sqlite3.Row) -> ScreenedArticle | None:
  title = normalize(row["title"])
  source = normalize(row["source_name"])
  text = " ".join([
    title,
    source,
    normalize(row["source_category"]),
    normalize(row["summary"]),
    normalize(row["content"]),
    normalize(row["html"]),
  ])

  dimensions = [
    score_investment(text, source),
    score_engineering(text, source),
    score_titans(text, source),
    score_breakthrough(text, source),
  ]
  total = sum(item.score for item in dimensions)
  if total < 80:
    return None

  active = [item for item in dimensions if item.score > 0]
  reason_lines = [f"{item.label}: {item.reason}" for item in active]
  edge = "；".join(reason_lines)
  note = feynman_note(title, dimensions)
  advice = "建议进入 Sunday Venture Studio 技术雷达，安排进一步人工复核；若含开源实现，优先复现其 Agent 记忆、工具调用或推理成本模块。"
  summary = (
    f"🎯 战略雷达 (Strategic Radar) - {datetime.now().strftime('%Y-%m-%d')}\n\n"
    f"{title_entity(title)} | 综合评分：{total}/100\n\n"
    f"🏷️ 核心标签：{' / '.join(tags_for(dimensions))}\n\n"
    f"📝 费曼解释 (Feynman Note)：\n{note}\n\n"
    f"🔪 破局点 (The Edge)：\n{edge}\n\n"
    f"💡 行动建议 (Actionable Advice)：\n{advice}"
  )
  return ScreenedArticle(
    article_id=int(row["id"]),
    score=total,
    front_category=front_category(dimensions),
    summary=summary,
    reason=edge,
    tags=tags_for(dimensions),
  )


def ensure_prompt_version(conn: sqlite3.Connection) -> int:
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
      "sunday-venture-v1",
      str(PROMPT_PATH.relative_to(ROOT)),
      "Sunday Venture Studio long-horizon agent and model architecture signal filter",
      "Heuristic deployment of the Sunday scoring matrix. Use LLM pass for final IC memo polish.",
    ),
  )
  row = conn.execute("SELECT id FROM prompt_versions WHERE version = ?", ("sunday-venture-v1",)).fetchone()
  return int(row[0])


def run_screen(db_path: Path, limit: int, clear_previous: bool) -> int:
  with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    prompt_version_id = ensure_prompt_version(conn)
    run = conn.execute(
      "INSERT INTO workflow_runs (run_type, status, input_count, notes) VALUES (?, ?, ?, ?)",
      ("screen_sunday_venture", "running", 0, str(PROMPT_PATH)),
    )
    run_id = int(run.lastrowid)

    if clear_previous:
      conn.execute(
        """
        DELETE FROM selected_news
        WHERE prompt_version_id = ?
          OR run_id IN (SELECT id FROM workflow_runs WHERE run_type = 'screen_sunday_venture')
        """,
        (prompt_version_id,),
      )

    rows = conn.execute(
      """
      SELECT id, title, source_name, source_category, summary, content, html, published_at, collected_at
      FROM ai_news_articles
      WHERE status IN ('collected', 'selected', 'published')
      ORDER BY COALESCE(published_at, collected_at) DESC, id DESC
      """
    ).fetchall()

    selected = [item for item in (screen_row(row) for row in rows) if item is not None]
    selected.sort(key=lambda item: (-item.score, item.article_id))
    if limit > 0:
      selected = selected[:limit]

    for rank, item in enumerate(selected, start=1):
      conn.execute(
        """
        INSERT INTO selected_news (
          run_id, article_id, prompt_version_id, selected_rank, front_category,
          score, editorial_summary, reason, tags_json, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'selected')
        ON CONFLICT(run_id, article_id) DO UPDATE SET
          selected_rank = excluded.selected_rank,
          front_category = excluded.front_category,
          score = excluded.score,
          editorial_summary = excluded.editorial_summary,
          reason = excluded.reason,
          tags_json = excluded.tags_json,
          status = excluded.status
        """,
        (
          run_id,
          item.article_id,
          prompt_version_id,
          rank,
          item.front_category,
          item.score,
          item.summary,
          item.reason,
          json.dumps(item.tags, ensure_ascii=False),
        ),
      )
      conn.execute(
        "UPDATE ai_news_articles SET status = 'selected', score = ?, screening_reason = ? WHERE id = ?",
        (item.score, item.reason, item.article_id),
      )

    conn.execute(
      "UPDATE workflow_runs SET status = ?, finished_at = CURRENT_TIMESTAMP, input_count = ?, output_count = ? WHERE id = ?",
      ("finished", len(rows), len(selected), run_id),
    )
    conn.commit()
    return len(selected)


def main() -> None:
  parser = argparse.ArgumentParser(description="Screen AI news for Sunday Venture Studio.")
  parser.add_argument("--db", type=Path, default=DEFAULT_DB)
  parser.add_argument("--limit", type=int, default=30)
  parser.add_argument("--keep-previous", action="store_true")
  args = parser.parse_args()

  count = run_screen(args.db, args.limit, clear_previous=not args.keep_previous)
  print(f"Selected {count} Sunday Venture Studio radar items.")


if __name__ == "__main__":
  main()
