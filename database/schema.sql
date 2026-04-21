CREATE TABLE IF NOT EXISTS rss_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  rss_url TEXT,
  rss_candidates_json TEXT NOT NULL DEFAULT '[]',
  availability TEXT NOT NULL DEFAULT 'unknown',
  status_note TEXT,
  content_focus TEXT,
  fallback_plan TEXT,
  requires_special_handling INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_markdown_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, website_url)
);

CREATE INDEX IF NOT EXISTS idx_rss_sources_category ON rss_sources(category);
CREATE INDEX IF NOT EXISTS idx_rss_sources_availability ON rss_sources(availability);
CREATE INDEX IF NOT EXISTS idx_rss_sources_active ON rss_sources(is_active);

CREATE TABLE IF NOT EXISTS ai_news_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL UNIQUE,
  source_id INTEGER,
  source_name TEXT,
  source_category TEXT,
  title TEXT NOT NULL,
  url TEXT,
  canonical_url TEXT,
  summary TEXT,
  content TEXT,
  html TEXT,
  image_url TEXT,
  language TEXT,
  published_at TEXT,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'collected',
  score REAL,
  screening_reason TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(source_id) REFERENCES rss_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_news_articles_source ON ai_news_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_ai_news_articles_status ON ai_news_articles(status);
CREATE INDEX IF NOT EXISTS idx_ai_news_articles_published ON ai_news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_news_articles_hash ON ai_news_articles(hash);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  input_count INTEGER NOT NULL DEFAULT 0,
  output_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_type_started ON workflow_runs(run_type, started_at DESC);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  prompt_path TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS selected_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER,
  article_id INTEGER NOT NULL,
  prompt_version_id INTEGER,
  selected_rank INTEGER NOT NULL,
  front_category TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  editorial_summary TEXT,
  reason TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'selected',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(run_id) REFERENCES workflow_runs(id),
  FOREIGN KEY(article_id) REFERENCES ai_news_articles(id),
  FOREIGN KEY(prompt_version_id) REFERENCES prompt_versions(id),
  UNIQUE(run_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_selected_news_status_rank ON selected_news(status, selected_rank);
CREATE INDEX IF NOT EXISTS idx_selected_news_article ON selected_news(article_id);
