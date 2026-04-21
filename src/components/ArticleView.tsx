/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Article, Category } from '../types';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { MOCK_ARTICLES } from '../constants';

interface ArticleViewProps {
  articleId: string;
  onBack: () => void;
  isDark: boolean;
  key?: string | number;
}

export function ArticleView({ articleId, onBack, isDark }: ArticleViewProps) {
  const currentArticle = MOCK_ARTICLES.find(a => a.id === articleId) || MOCK_ARTICLES[0];
  const [readingList, setReadingList] = useState<Article[]>([currentArticle]);
  
  // Logic to load "next" article when scrolling to bottom
  const loadNext = () => {
    const lastArticle = readingList[readingList.length - 1];
    const currentIndex = MOCK_ARTICLES.findIndex(a => a.id === lastArticle.id);
    const nextIndex = (currentIndex + 1) % MOCK_ARTICLES.length;
    const nextArticle = MOCK_ARTICLES[nextIndex];
    
    if (!readingList.find(a => a.id === nextArticle.id)) {
      setReadingList(prev => [...prev, nextArticle]);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadNext();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [readingList]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "max-w-[680px] mx-auto pt-24 pb-64 px-6",
        !isDark && "text-reading-ink"
      )}
    >
      <button
        onClick={onBack}
        className={cn(
          "fixed top-24 left-8 p-3 rounded-full hidden xl:flex",
          "border hairline-border backdrop-blur-md transition-all group",
          isDark ? "bg-dark-bg/40 border-design-border text-white hover:border-brand-yellow/50" : "bg-reading-surface/90 border-reading-border text-reading-ink hover:border-reading-accent"
        )}
      >
        <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
      </button>

      {readingList.map((article, index) => (
        <article key={`${article.id}-${index}`} className="mb-32 relative">
          {index > 0 && (
            <div className={cn(
              "absolute -top-16 left-0 right-0 h-[120px] flex flex-col justify-center px-0 opacity-80 pointer-events-none",
              isDark ? "bg-gradient-to-t from-dark-card to-transparent" : "bg-gradient-to-t from-reading-bg to-transparent"
            )}>
              <div className={cn("text-[10px] uppercase font-bold tracking-[2px] mb-2", isDark ? "text-brand-yellow" : "text-reading-muted")}>Seamless Next: {article.category}</div>
              <div className={cn("text-xl font-medium", isDark ? "text-dark-text-dim" : "text-reading-muted")}>{article.title}</div>
            </div>
          )}

          <header className="mb-10">
            <div className="flex flex-wrap gap-3 mb-8">
              <span className={cn(
                "text-[10px] font-bold tracking-widest uppercase py-1 px-3 rounded-sm border hairline-border",
                isDark ? "bg-brand-yellow/10 border-brand-yellow/50 text-brand-yellow" : "bg-reading-accent-soft border-reading-border text-reading-accent"
              )}>
                {article.category}
              </span>
              <span className={cn(
                "text-[10px] font-bold tracking-widest uppercase py-1 px-3 rounded-sm border hairline-border",
                isDark ? "bg-brand-green/5 border-brand-green/30 text-brand-green" : "bg-reading-surface border-reading-border text-reading-muted"
              )}>
                Alpha Capture
              </span>
            </div>

            <h1 className={cn(
              "text-[42px] leading-[1.1] font-display font-semibold mb-8 tracking-tight",
              isDark ? "text-white" : "text-reading-ink"
            )}>
              {article.title}
            </h1>

            <div className={cn(
               "flex items-center gap-6 text-[12px] pb-8 border-b hairline-border",
               isDark ? "text-dark-text-dim border-design-border" : "text-reading-muted border-reading-border"
            )}>
              <span>By {article.sourceName || article.author || 'VANE Editorial Agent'}</span>
              <span>Reading Time: {article.readTime}</span>
              <span>482 Reads</span>
              {article.sourceUrl && (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1",
                    isDark ? "text-brand-yellow hover:text-brand-green" : "text-reading-accent underline underline-offset-4 hover:text-reading-blue"
                  )}
                >
                  Source <ExternalLink size={12} />
                </a>
              )}
            </div>
          </header>

          <div className="grid grid-cols-1 gap-12">
            <div 
              className={cn(
                "prose max-w-none prose-p:font-light prose-p:leading-relaxed prose-p:text-lg",
                "prose-headings:font-display prose-headings:font-semibold",
                isDark
                  ? "prose-invert prose-ul:marker:text-brand-yellow prose-a:text-brand-yellow prose-a:no-underline prose-a:border-b prose-a:border-brand-yellow prose-a:pb-px text-white/85"
                  : "prose-headings:text-reading-ink prose-p:text-reading-ink/85 prose-strong:text-reading-ink prose-a:text-reading-accent prose-a:no-underline prose-a:border-b prose-a:border-reading-accent prose-a:pb-px prose-ul:marker:text-reading-muted text-reading-ink/85"
              )}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>

          <div className="mt-16 flex flex-wrap gap-2">
            {article.tags.map(tag => (
              <span key={tag} className={cn(
                "text-[10px] font-mono uppercase border hairline-border px-3 py-1 rounded-sm",
                isDark ? "border-design-border text-dark-text-dim hover:text-white" : "border-reading-border text-reading-muted hover:text-reading-accent"
              )}>
                # {tag}
              </span>
            ))}
          </div>
        </article>
      ))}
    </motion.div>
  );
}
