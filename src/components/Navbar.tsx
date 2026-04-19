/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { CATEGORIES } from '../constants';
import { Category } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  currentCategory: Category | 'All';
  setCategory: (c: Category | 'All') => void;
  isDark: boolean;
  toggleTheme: () => void;
}

export function Navbar({ currentCategory, setCategory, isDark, toggleTheme }: NavbarProps) {
  const [time, setTime] = useState('14:02 UTC');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(`${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')} UTC`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-40 h-[60px]",
      "flex items-center justify-between px-8",
      "backdrop-blur-xl border-b hairline-border transition-colors",
      isDark 
        ? "bg-dark-bg/90 border-design-border text-white" 
        : "bg-light-bg/90 border-black/10 text-black"
    )}>
      <div 
        onClick={() => setCategory('All')}
        className="cursor-pointer logo font-extrabold text-xl tracking-[4px] uppercase"
      >
        VA<span className="text-brand-yellow">N</span>E
      </div>

      <div className="hidden md:flex items-center gap-1">
        {['All', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat as Category | 'All')}
            className={cn(
              "relative px-4 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-[0.15em] transition-all duration-300",
              currentCategory === cat 
                ? (isDark ? "text-brand-yellow" : "text-black")
                : (isDark ? "text-dark-text-dim hover:text-white" : "text-black/60 hover:text-black")
            )}
          >
            <span className="relative z-10">{cat}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-6 text-[12px] font-semibold uppercase tracking-[1px] text-dark-text-dim">
        <span className="hidden sm:inline">{time}</span>
        <span className="hidden sm:inline">Signal: High</span>
        <div className="flex items-center gap-2 text-brand-yellow">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(204,255,0,0.8)]" />
          <span>Live</span>
        </div>
        <ThemeToggle isDark={isDark} toggle={toggleTheme} />
      </div>
    </header>
  );
}
