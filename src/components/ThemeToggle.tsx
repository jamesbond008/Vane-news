/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  isDark: boolean;
  toggle: () => void;
}

export function ThemeToggle({ isDark, toggle }: ThemeToggleProps) {
  return (
    <button
      onClick={toggle}
      className={cn(
        "relative p-2 rounded-full overflow-hidden transition-all duration-500 hover:scale-110 active:scale-95",
        "backdrop-blur-sm border hairline-border",
        isDark ? "bg-white/5 border-brand-yellow/20 text-brand-yellow" : "bg-reading-surface border-reading-border text-reading-ink hover:bg-reading-accent-soft"
      )}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? 'dark' : 'light'}
          initial={{ y: 20, rotate: 45, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -20, rotate: -45, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'backOut' }}
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
