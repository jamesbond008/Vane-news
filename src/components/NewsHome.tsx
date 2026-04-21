import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, Radio } from 'lucide-react';
import { CATEGORIES } from '../constants';
import { Article, Category } from '../types';
import { cn } from '../lib/utils';

interface NewsHomeProps {
  articles: Article[];
  currentCategory: Category | 'All';
  setCategory: (category: Category | 'All') => void;
  onSelectArticle: (id: string) => void;
  isDark: boolean;
}

function mutedText(isDark: boolean) {
  return isDark ? 'text-dark-text-dim' : 'text-reading-muted';
}

function rowBorder(isDark: boolean) {
  return isDark ? 'border-design-border' : 'border-reading-border';
}

function categoryCount(articles: Article[], category: Category) {
  return articles.filter((article) => article.category === category).length;
}

function formatTime(article: Article) {
  return article.date || 'No date';
}

export function NewsHome({ articles, currentCategory, setCategory, onSelectArticle, isDark }: NewsHomeProps) {
  const filteredArticles = useMemo(() => {
    if (currentCategory === 'All') return articles;
    return articles.filter((article) => article.category === currentCategory);
  }, [articles, currentCategory]);

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 md:px-8 pt-7 pb-24">
        <header className={cn(
          "border-b hairline-border pb-5",
          rowBorder(isDark),
        )}>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className={cn(
                "inline-flex items-center gap-2 h-8 px-3 rounded-sm border hairline-border text-[10px] font-mono uppercase tracking-widest",
                isDark ? "border-design-border bg-white/[0.03] text-brand-yellow" : "border-reading-border bg-reading-surface text-reading-accent"
              )}>
                <Radio size={14} />
                News Feed
              </div>
              <h1 className="mt-5 text-3xl md:text-5xl font-display font-semibold tracking-tight">
                Articles
              </h1>
              <p className={cn("mt-2 text-sm", mutedText(isDark))}>
                {filteredArticles.length} visible · {articles.length} indexed
              </p>
            </div>

            <nav className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategory('All')}
                className={cn(
                  "h-9 px-3 rounded-sm border hairline-border text-xs font-mono uppercase transition-colors",
                  currentCategory === 'All'
                    ? (isDark ? "border-brand-yellow/50 text-brand-yellow bg-brand-yellow/10" : "border-reading-accent text-reading-ink bg-reading-accent-soft")
                    : (isDark ? "border-design-border text-dark-text-dim hover:text-white" : "border-reading-border text-reading-muted hover:border-reading-accent hover:text-reading-ink")
                )}
              >
                All {articles.length}
              </button>
              {CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  onClick={() => setCategory(category)}
                  className={cn(
                    "h-9 px-3 rounded-sm border hairline-border text-xs font-mono uppercase transition-colors",
                    currentCategory === category
                      ? (isDark ? "border-brand-yellow/50 text-brand-yellow bg-brand-yellow/10" : "border-reading-accent text-reading-ink bg-reading-accent-soft")
                      : (isDark ? "border-design-border text-dark-text-dim hover:text-white" : "border-reading-border text-reading-muted hover:border-reading-accent hover:text-reading-ink")
                  )}
                >
                  {category} {categoryCount(articles, category)}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <section className={cn(
          "mt-5 overflow-hidden rounded-sm border hairline-border",
          isDark ? "border-design-border bg-dark-card/70" : "border-reading-border bg-reading-surface shadow-[0_18px_60px_rgba(28,38,28,0.06)]"
        )}>
          {filteredArticles.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <Clock size={22} className={cn("mb-3", mutedText(isDark))} />
              <h2 className="text-lg font-display font-semibold">No articles yet</h2>
              <p className={cn("mt-2 max-w-md text-sm leading-6", mutedText(isDark))}>
                数据库已经清理。运行 RSS 抓取和筛选后，这里会以单列形式显示标题和时间。
              </p>
            </div>
          ) : (
            filteredArticles.map((article, index) => (
              <motion.button
                type="button"
                key={article.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.01, 0.16) }}
                onClick={() => onSelectArticle(article.id)}
                className={cn(
                  "group grid w-full grid-cols-[minmax(0,1fr)_104px] md:grid-cols-[minmax(0,1fr)_132px] gap-4 border-b hairline-border px-4 py-3.5 text-left transition-colors last:border-b-0",
                  isDark ? "border-design-border hover:bg-white/[0.04]" : "border-reading-border hover:bg-reading-accent-soft/70"
                )}
              >
                <h2 className={cn(
                  "min-w-0 truncate text-sm md:text-base font-semibold leading-6",
                  isDark ? "group-hover:text-brand-yellow" : "text-reading-ink group-hover:text-reading-accent"
                )}>
                  {article.title}
                </h2>
                <time className={cn("justify-self-end whitespace-nowrap text-xs font-mono leading-6", mutedText(isDark))}>
                  {formatTime(article)}
                </time>
              </motion.button>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
