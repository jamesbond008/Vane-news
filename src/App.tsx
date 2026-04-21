/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Category } from './types';
import { CATEGORIES, MOCK_ARTICLES } from './constants';
import { Navbar } from './components/Navbar';
import { ArticleView } from './components/ArticleView';
import { ArticleManager } from './components/ArticleManager';
import { NewsHome } from './components/NewsHome';
import { ProgressBar } from './components/ProgressBar';
import { Sparkles, Terminal, BookOpen, Brain, Zap } from 'lucide-react';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [viewMode, setViewMode] = useState<'feed' | 'database'>('feed');
  const [currentCategory, setCurrentCategory] = useState<Category | 'All'>('All');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.style.backgroundColor = isDark ? '#050505' : '#F3F5F1';
    document.body.style.backgroundColor = isDark ? '#050505' : '#F3F5F1';
    document.body.style.color = isDark ? '#FFFFFF' : '#172019';
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const getCategoryIcon = (cat: string) => {
    if (!isDark) {
      switch (cat) {
        case 'Investment': return <Zap className="text-reading-accent" size={16} />;
        case 'GitHub': return <Terminal className="text-reading-blue" size={16} />;
        case 'News': return <BookOpen className="text-reading-muted" size={16} />;
        case 'Minds': return <Brain className="text-reading-blue" size={16} />;
        case 'Research': return <Sparkles className="text-reading-accent" size={16} />;
        default: return <Sparkles className="text-reading-muted" size={16} />;
      }
    }
    switch (cat) {
      case 'Investment': return <Zap className="text-brand-yellow" size={16} />;
      case 'GitHub': return <Terminal className="text-brand-green" size={16} />;
      case 'News': return <BookOpen className="text-blue-400" size={16} />;
      case 'Minds': return <Brain className="text-purple-400" size={16} />;
      case 'Research': return <Sparkles className="text-orange-400" size={16} />;
      default: return <Sparkles size={16} />;
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-700",
      isDark ? "bg-dark-bg text-white" : "bg-reading-bg text-reading-ink"
    )}>
      <ProgressBar isDark={isDark} />
      
      <Navbar 
        currentCategory={currentCategory} 
        setCategory={setCurrentCategory} 
        viewMode={viewMode}
        setViewMode={(mode) => {
          setViewMode(mode);
          setSelectedArticleId(null);
        }}
        isDark={isDark} 
        toggleTheme={toggleTheme} 
      />

      <main className="relative pt-24 pb-32 h-screen overflow-hidden flex">
        <AnimatePresence mode="wait">
          {viewMode === 'database' ? (
            <motion.div
              key="database-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex overflow-hidden"
            >
              <ArticleManager isDark={isDark} />
            </motion.div>
          ) : !selectedArticleId ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex overflow-hidden"
            >
              <NewsHome
                articles={MOCK_ARTICLES}
                currentCategory={currentCategory}
                setCategory={setCurrentCategory}
                onSelectArticle={setSelectedArticleId}
                isDark={isDark}
              />
            </motion.div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <ArticleView 
                key="article-view"
                articleId={selectedArticleId} 
                onBack={() => setSelectedArticleId(null)} 
                isDark={isDark}
              />
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className={cn(
        "py-12 border-t hairline-border",
        isDark ? "border-white/5 bg-dark-bg" : "border-reading-border bg-reading-surface text-reading-ink"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className={cn(
            "flex items-center gap-12 font-mono text-[10px] uppercase tracking-widest",
            isDark ? "text-white/40" : "text-reading-muted"
          )}>
            <span>© 2026 VANE COGNITION</span>
            <span className="hidden sm:inline">DATA: ArXiv & GitHub</span>
            <span className="hidden sm:inline">REASONING: GEMINI-3-FLASH</span>
          </div>
          
          <div className="flex items-center gap-8">
            {CATEGORIES.map(cat => (
              <div key={cat} className={cn(
                "flex items-center gap-2 transition-opacity cursor-help",
                isDark ? "opacity-50 hover:opacity-100" : "opacity-75 hover:opacity-100"
              )}>
                {getCategoryIcon(cat)}
                <span className="text-[10px] font-mono">{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
