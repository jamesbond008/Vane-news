import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Database,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Star,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

type NewsStatus = 'collected' | 'selected' | 'published' | 'rejected' | 'archived';

interface DbArticle {
  id: number;
  source_name: string | null;
  source_category: string | null;
  title: string;
  url: string | null;
  summary: string | null;
  content: string | null;
  html: string | null;
  image_url: string | null;
  language: string | null;
  published_at: string | null;
  collected_at: string;
  status: NewsStatus;
  score: number | null;
  screening_reason: string | null;
  tags_json: string | null;
}

interface MetaResponse {
  total: number;
  statuses: Array<{ status: NewsStatus; count: number }>;
  sources: Array<{ source_name: string; count: number }>;
}

interface ArticlesResponse {
  page: number;
  limit: number;
  total: number;
  articles: DbArticle[];
}

interface ArticleManagerProps {
  isDark: boolean;
}

const STATUS_OPTIONS: Array<{ value: NewsStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'collected', label: 'Collected' },
  { value: 'selected', label: 'Selected' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_ACTIONS: Array<{ value: NewsStatus; label: string; icon: typeof CheckCircle2 }> = [
  { value: 'selected', label: 'Select', icon: Star },
  { value: 'published', label: 'Publish', icon: CheckCircle2 },
  { value: 'rejected', label: 'Reject', icon: XCircle },
  { value: 'archived', label: 'Archive', icon: Archive },
];

function formatDate(value: string | null) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function plainText(value: string | null | undefined) {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function excerpt(article: DbArticle) {
  const text = plainText(article.summary || article.content || article.html);
  return text.length > 220 ? `${text.slice(0, 219)}...` : text;
}

function parseTags(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.slice(0, 8).map(String) : [];
  } catch {
    return [];
  }
}

function statusTone(status: string, isDark: boolean) {
  switch (status) {
    case 'published':
      return isDark ? 'border-brand-green/30 bg-brand-green/10 text-brand-green' : 'border-emerald-700/20 bg-emerald-50 text-emerald-800';
    case 'selected':
      return isDark ? 'border-brand-yellow/30 bg-brand-yellow/10 text-brand-yellow' : 'border-amber-700/20 bg-amber-50 text-amber-800';
    case 'rejected':
      return isDark ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-red-700/20 bg-red-50 text-red-800';
    case 'archived':
      return isDark ? 'border-white/15 bg-white/5 text-dark-text-dim' : 'border-reading-border bg-reading-accent-soft text-reading-muted';
    default:
      return isDark ? 'border-blue-400/30 bg-blue-400/10 text-blue-300' : 'border-blue-700/20 bg-blue-50 text-blue-800';
  }
}

function managerAccent(isDark: boolean) {
  return isDark ? 'text-brand-yellow' : 'text-reading-accent';
}

function managerMuted(isDark: boolean) {
  return isDark ? 'text-dark-text-dim' : 'text-reading-muted';
}

function managerSubtle(isDark: boolean) {
  return isDark ? 'text-dark-text-dim' : 'text-reading-ink/72';
}

export function ArticleManager({ isDark }: ArticleManagerProps) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [articles, setArticles] = useState<DbArticle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<NewsStatus | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedId) || articles[0],
    [articles, selectedId],
  );

  const totalPages = Math.max(1, Math.ceil(total / 50));

  useEffect(() => {
    fetch('/api/news/meta')
      .then((response) => response.json())
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : 'Meta load failed'));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '50',
    });
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (source) params.set('source', source);
    if (status) params.set('status', status);

    setLoading(true);
    setError('');

    fetch(`/api/news/articles?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Article API failed: ${response.status}`);
        return response.json() as Promise<ArticlesResponse>;
      })
      .then((payload) => {
        setArticles(payload.articles);
        setTotal(payload.total);
        setSelectedId(payload.articles[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Article load failed'))
      .finally(() => setLoading(false));
  }, [debouncedQuery, source, status, page]);

  const setArticleStatus = async (articleId: number, nextStatus: NewsStatus) => {
    setSavingId(articleId);
    setError('');
    try {
      const response = await fetch(`/api/news/articles/${articleId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error(`Status update failed: ${response.status}`);
      setArticles((current) => current.map((article) => (
        article.id === articleId ? { ...article, status: nextStatus } : article
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex-1 min-w-0 h-full overflow-hidden">
      <div className="h-full flex flex-col px-5 md:px-8 xl:px-10 pt-8 pb-6">
        <section className={cn(
          "flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 pb-6 border-b hairline-border",
          isDark ? "border-design-border" : "border-reading-border"
        )}>
          <div>
            <div className={cn("inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest mb-3", managerAccent(isDark))}>
              <Database size={14} />
              SQLite Article Control
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-semibold tracking-tight">
              News Database
            </h1>
            <p className={cn("mt-2 text-sm", isDark ? "text-dark-text-dim" : "text-reading-muted")}>
              {meta?.total ?? total} collected articles · {total} in current view
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-3">
            {(meta?.statuses || []).map((item) => (
              <div
                key={item.status}
                className={cn(
                  "min-w-[106px] border hairline-border rounded-sm px-3 py-2",
                  isDark ? "bg-white/[0.03] border-design-border" : "bg-reading-surface border-reading-border",
                )}
              >
                  <div className={cn("text-[10px] uppercase font-mono", managerMuted(isDark))}>{item.status}</div>
                <div className="text-xl font-semibold">{item.count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] gap-5 min-h-0 flex-1 pt-5">
          <div className={cn(
            "min-h-0 flex flex-col border hairline-border rounded-sm",
            isDark ? "bg-dark-card/80 border-design-border" : "bg-reading-surface border-reading-border",
          )}>
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-[1fr_190px_170px] gap-3 p-4 border-b hairline-border",
              isDark ? "border-design-border" : "border-reading-border"
            )}>
              <label className="relative block">
                <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2", managerAccent(isDark))} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, summary, source..."
                  className={cn(
                    "w-full h-10 pl-10 pr-3 rounded-sm border hairline-border text-sm outline-none",
                    isDark ? "bg-black/30 border-design-border text-white placeholder:text-white/35" : "bg-reading-panel border-reading-border text-reading-ink placeholder:text-reading-muted/70",
                  )}
                />
              </label>

              <label className="relative block">
                <Filter size={15} className={cn("absolute left-3 top-1/2 -translate-y-1/2", managerAccent(isDark))} />
                <select
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value);
                    setPage(1);
                  }}
                  className={cn(
                    "w-full h-10 pl-9 pr-3 rounded-sm border hairline-border text-sm outline-none",
                    isDark ? "bg-black/30 border-design-border text-white" : "bg-reading-panel border-reading-border text-reading-ink",
                  )}
                >
                  <option value="">All sources</option>
                  {(meta?.sources || []).map((item) => (
                    <option key={item.source_name} value={item.source_name}>
                      {item.source_name} ({item.count})
                    </option>
                  ))}
                </select>
              </label>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as NewsStatus | '');
                  setPage(1);
                }}
                className={cn(
                  "w-full h-10 px-3 rounded-sm border hairline-border text-sm outline-none",
                  isDark ? "bg-black/30 border-design-border text-white" : "bg-reading-panel border-reading-border text-reading-ink",
                )}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className={cn(
                "mx-4 mt-4 border text-sm px-3 py-2 rounded-sm",
                isDark ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-red-700/20 bg-red-50 text-red-800"
              )}>
                {error}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className={cn("h-full flex items-center justify-center", managerMuted(isDark))}>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Loading database rows
                </div>
              ) : articles.length === 0 ? (
                <div className={cn("h-full flex items-center justify-center", managerMuted(isDark))}>
                  No matching articles
                </div>
              ) : (
                articles.map((article) => (
                  <button
                    type="button"
                    key={article.id}
                    onClick={() => setSelectedId(article.id)}
                    className={cn(
                      "w-full text-left px-4 py-4 border-b hairline-border transition-colors",
                      isDark ? "border-design-border hover:bg-white/[0.04]" : "border-reading-border hover:bg-reading-accent-soft/70",
                      selectedArticle?.id === article.id && (isDark ? "bg-brand-yellow/[0.06]" : "bg-reading-accent-soft"),
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={cn("text-[10px] font-mono uppercase border rounded-sm px-2 py-0.5", statusTone(article.status, isDark))}>
                            {article.status}
                          </span>
                          <span className={cn("text-[10px] font-mono", managerMuted(isDark))}>
                            #{article.id}
                          </span>
                          <span className={cn("text-[10px] font-mono", managerMuted(isDark))}>
                            {formatDate(article.published_at || article.collected_at)}
                          </span>
                        </div>
                        <h3 className="text-sm md:text-base font-semibold leading-snug line-clamp-2">
                          {article.title}
                        </h3>
                        <p className={cn("mt-2 text-xs line-clamp-2", managerSubtle(isDark))}>
                          {excerpt(article) || 'No summary captured yet.'}
                        </p>
                      </div>
                      <div className={cn("shrink-0 text-right text-[10px] font-mono max-w-[120px] truncate", managerMuted(isDark))}>
                        {article.source_name || 'Unknown'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 border-t hairline-border",
              isDark ? "border-design-border" : "border-reading-border"
            )}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className={cn("text-xs font-mono uppercase disabled:opacity-30", isDark ? "hover:text-brand-yellow" : "hover:text-reading-accent")}
              >
                Previous
              </button>
              <span className={cn("text-xs font-mono", managerMuted(isDark))}>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className={cn("text-xs font-mono uppercase disabled:opacity-30", isDark ? "hover:text-brand-yellow" : "hover:text-reading-accent")}
              >
                Next
              </button>
            </div>
          </div>

          <aside className={cn(
            "min-h-0 overflow-y-auto border hairline-border rounded-sm",
            isDark ? "bg-dark-card/80 border-design-border" : "bg-reading-surface border-reading-border",
          )}>
            {selectedArticle ? (
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-5">
                  <span className={cn("text-[10px] font-mono uppercase border rounded-sm px-2 py-0.5", statusTone(selectedArticle.status, isDark))}>
                    {selectedArticle.status}
                  </span>
                  <span className={cn("text-[10px] font-mono", managerMuted(isDark))}>#{selectedArticle.id}</span>
                  <span className={cn("text-[10px] font-mono", managerMuted(isDark))}>
                    {selectedArticle.source_name || 'Unknown Source'}
                  </span>
                </div>

                <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight tracking-tight">
                  {selectedArticle.title}
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {parseTags(selectedArticle.tags_json).map((tag) => (
                    <span key={tag} className={cn(
                      "text-[10px] font-mono uppercase border hairline-border px-2 py-1 rounded-sm",
                      isDark ? "border-design-border text-dark-text-dim" : "border-reading-border text-reading-muted"
                    )}>
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                  <div className={cn("border hairline-border rounded-sm px-3 py-2", isDark ? "border-design-border" : "border-reading-border")}>
                    <div className={cn("font-mono uppercase text-[10px]", managerMuted(isDark))}>Published</div>
                    <div>{formatDate(selectedArticle.published_at)}</div>
                  </div>
                  <div className={cn("border hairline-border rounded-sm px-3 py-2", isDark ? "border-design-border" : "border-reading-border")}>
                    <div className={cn("font-mono uppercase text-[10px]", managerMuted(isDark))}>Category</div>
                    <div>{selectedArticle.source_category || 'Unknown'}</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {STATUS_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.value}
                        type="button"
                        disabled={savingId === selectedArticle.id}
                        onClick={() => setArticleStatus(selectedArticle.id, action.value)}
                        className={cn(
                          "inline-flex items-center gap-2 h-9 px-3 rounded-sm border hairline-border text-xs font-mono uppercase transition-colors",
                          isDark ? "border-design-border hover:border-brand-yellow/50" : "border-reading-border hover:border-reading-accent",
                        )}
                      >
                        {savingId === selectedArticle.id ? <Loader2 className="animate-spin" size={14} /> : <Icon size={14} />}
                        {action.label}
                      </button>
                    );
                  })}
                  {selectedArticle.url && (
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 h-9 px-3 rounded-sm border hairline-border text-xs font-mono uppercase",
                        isDark ? "border-design-border hover:text-brand-yellow" : "border-reading-border hover:text-reading-accent"
                      )}
                    >
                      <ExternalLink size={14} />
                      Source
                    </a>
                  )}
                </div>

                <div className="mt-8">
                  <div className={cn("text-[10px] font-mono uppercase tracking-widest mb-3", managerAccent(isDark))}>
                    Captured Summary
                  </div>
                  <p className={cn("text-sm leading-7", managerSubtle(isDark))}>
                    {excerpt(selectedArticle) || 'No summary captured yet.'}
                  </p>
                </div>

                <div className="mt-8">
                  <div className={cn("text-[10px] font-mono uppercase tracking-widest mb-3", managerAccent(isDark))}>
                    Raw Content Preview
                  </div>
                  <div className={cn(
                    "max-h-[420px] overflow-y-auto rounded-sm border hairline-border p-4 text-sm leading-7",
                    isDark ? "border-design-border bg-black/20 text-white/75" : "border-reading-border bg-reading-panel text-reading-ink/75",
                  )}>
                    {plainText(selectedArticle.content || selectedArticle.html || selectedArticle.summary) || 'No content body captured.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn("h-full min-h-[360px] flex items-center justify-center", managerMuted(isDark))}>
                Select an article
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
