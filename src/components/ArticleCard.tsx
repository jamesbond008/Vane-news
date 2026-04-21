/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Category, Article } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { ArrowRight, Clock, Tag } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onClick: (id: string) => void;
  isDark: boolean;
  key?: string | number;
}

export function ArticleCard({ article, onClick, isDark }: ArticleCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      onClick={() => onClick(article.id)}
      className={cn(
        "group cursor-pointer p-6 rounded-sm transition-all duration-500",
        "border hairline-border liquid-metal transition-colors",
        isDark 
          ? "bg-dark-card border-design-border hover:border-brand-yellow/30" 
          : "bg-reading-surface border-reading-border hover:border-reading-accent"
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border hairline-border",
          isDark 
            ? "bg-brand-yellow/10 border-brand-yellow/30 text-brand-yellow" 
            : "bg-reading-accent-soft border-reading-border text-reading-accent"
        )}>
          {article.category}
        </span>
        <span className={cn(
          "text-[10px] font-mono",
          isDark ? "text-dark-text-dim" : "text-reading-muted"
        )}>
          {article.date}
        </span>
      </div>

      <h3 className={cn(
        "text-xl font-display font-semibold mb-4 leading-tight transition-colors tracking-tight",
        isDark ? "text-white group-hover:text-brand-yellow/90" : "text-reading-ink group-hover:text-reading-accent"
      )}>
        {article.title}
      </h3>

      <p className={cn(
        "text-sm font-sans line-clamp-2 mb-8 opacity-60 leading-relaxed font-light",
        isDark ? "text-dark-text-dim" : "text-reading-muted"
      )}>
        {article.excerpt}
      </p>

      <div className={cn(
        "flex items-center justify-between pt-4 border-t hairline-border",
        isDark ? "border-design-border" : "border-reading-border"
      )}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 opacity-60">
            <Clock size={12} className={cn(isDark ? "text-brand-yellow" : "text-reading-muted")} />
            <span className={cn("text-[10px] font-mono", isDark ? "text-dark-text-dim" : "text-reading-muted")}>{article.readTime}</span>
          </div>
        </div>
        
        <motion.div 
          className={cn(
            "p-2 rounded-full",
            isDark ? "text-brand-yellow" : "text-reading-accent"
          )}
          whileHover={{ x: 4 }}
        >
          <ArrowRight size={14} />
        </motion.div>
      </div>
    </motion.div>
  );
}
