/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useScroll, useSpring } from 'motion/react';
import { cn } from '../lib/utils';

export function ProgressBar({ isDark }: { isDark: boolean }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className={cn(
        "fixed top-0 left-0 right-0 h-[2px] z-50 origin-left",
        isDark ? "bg-brand-yellow shadow-[0_0_8px_rgba(239,255,0,0.5)]" : "bg-black"
      )}
      style={{ scaleX }}
    />
  );
}
