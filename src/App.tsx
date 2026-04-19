/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Category, Article } from './types';
import { CATEGORIES, MOCK_ARTICLES } from './constants';
import { Navbar } from './components/Navbar';
import { ArticleCard } from './components/ArticleCard';
import { ArticleView } from './components/ArticleView';
import { ProgressBar } from './components/ProgressBar';
import { Sparkles, Terminal, BookOpen, Brain, Zap } from 'lucide-react';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [currentCategory, setCurrentCategory] = useState<Category | 'All'>('All');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    if (currentCategory === 'All') return MOCK_ARTICLES;
    return MOCK_ARTICLES.filter((a) => a.category === currentCategory);
  }, [currentCategory]);

  useEffect(() => {
    // Force dark class on body if needed (though not using class-based dark mode here for simplicity,
    // just passing isDark state prop-down)
    document.documentElement.style.backgroundColor = isDark ? '#050505' : '#F9F9F9';
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const getCategoryIcon = (cat: string) => {
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
      isDark ? "bg-dark-bg text-white" : "bg-light-bg text-black"
    )}>
      <ProgressBar isDark={isDark} />
      
      <Navbar 
        currentCategory={currentCategory} 
        setCategory={setCurrentCategory} 
        isDark={isDark} 
        toggleTheme={toggleTheme} 
      />

      <main className="relative pt-24 pb-32 h-screen overflow-hidden flex">
        <AnimatePresence mode="wait">
          {!selectedArticleId ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex overflow-hidden"
            >
              <aside className={cn(
                "hidden xl:flex w-[240px] flex-shrink-0 flex-col p-8 border-r hairline-border transition-colors",
                isDark ? "border-design-border" : "border-black/5"
              )}>
                <div className="space-y-6">
                  {['All', ...CATEGORIES].map((cat, idx) => (
                    <div 
                      key={cat}
                      onClick={() => setCurrentCategory(cat as Category | 'All')}
                      className={cn(
                        "flex items-center justify-between text-[13px] font-semibold uppercase tracking-wider cursor-pointer transition-all",
                        currentCategory === cat ? "text-brand-yellow" : "text-dark-text-dim hover:text-white"
                      )}
                    >
                      <span>{cat}</span>
                      <span className="text-[10px] font-mono opacity-30">{(idx * 7 + 4).toString().padStart(2, '0')}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8 border-t hairline-border border-design-border">
                  <div className="flex items-center justify-between text-[11px] font-bold text-dark-text-dim tracking-widest uppercase">
                    <span>Sensitivity</span>
                    <span className="text-brand-green">Beta 0.94</span>
                  </div>
                </div>
              </aside>

              <div className="flex-1 overflow-y-auto pt-12 px-12">
                {/* Hero Section */}
                <section className="mb-20 text-left">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="mb-6 inline-block"
                  >
                    <div className={cn(
                      "inline-flex items-center gap-2 px-4 py-1.5 rounded-full border hairline-border",
                      isDark ? "bg-white/5 border-design-border" : "bg-black/5 border-black/10"
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(204,255,0,0.8)]" />
                      <span className="text-[10px] font-mono tracking-widest uppercase opacity-60">System Ready • Capturing Beta</span>
                    </div>
                  </motion.div>
                  
                  <h1 className="text-6xl md:text-8xl font-display font-semibold tracking-tighter leading-[0.85] mb-8 select-none">
                    SIGNAL IN<br />THE NOISE<span className="text-brand-yellow">.</span>
                  </h1>
                </section>

                {/* Grid Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24">
                  {filteredArticles.map((article) => (
                    <ArticleCard 
                      key={article.id} 
                      article={article} 
                      onClick={setSelectedArticleId}
                      isDark={isDark}
                    />
                  ))}
                </div>
              </div>
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
        isDark ? "border-white/5 bg-dark-bg" : "border-black/5 bg-light-bg"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-12 font-mono text-[10px] uppercase tracking-widest opacity-40">
            <span>© 2026 VANE COGNITION</span>
            <span className="hidden sm:inline">DATA: ArXiv & GitHub</span>
            <span className="hidden sm:inline">REASONING: GEMINI-3-FLASH</span>
          </div>
          
          <div className="flex items-center gap-8">
            {CATEGORIES.map(cat => (
              <div key={cat} className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-help">
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
