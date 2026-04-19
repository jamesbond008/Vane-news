/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Article, Category } from './types';

export const CATEGORIES: Category[] = ['Investment', 'GitHub', 'News', 'Minds', 'Research'];

export const MOCK_ARTICLES: Article[] = [
  {
    id: '1',
    category: 'Investment',
    title: 'The Rise of Agentic Capital: How VC models are evolving for the Agent-first world',
    excerpt: 'Traditional SaaS metrics are dead. In a world where agents are the primary users, we need new mental models for valuation.',
    content: `
      <p>The transition from "User-Interface" (UI) centric software to "Agent-Interface" (AI) centric software is not just a technical shift—it's a capital shift. For the past decade, Venture Capital has relied on metrics like CAC (Customer Acquisition Cost) and LTV (Lifetime Value) centered around human attention spans.</p>
      <p>But when your "user" is a long-horizon agent that operates 24/7, those metrics break down. We are entering the era of <strong>Agentic Capital</strong>.</p>
      <h2>The Post-SaaS Metric Stack</h2>
      <p>In the Agentic world, attention is no longer the bottleneck. Compute and API reliability are. Investors are now looking at:</p>
      <ul>
        <li><strong>E/C Ratio:</strong> Effective Output vs. Compute Cost.</li>
        <li><strong>Agent-Retention:</strong> How sticky is your API for autonomous workflows?</li>
        <li><strong>Protocol Alpha:</strong> The defensibility of your underlying orchestration layer.</li>
      </ul>
      <p>We see a significant "Alpha" shift towards projects that prioritize low-friction machine-to-machine transactions.</p>
    `,
    date: '2026-04-18',
    author: 'VANE Analysis',
    tags: ['VC', 'AI Economy', 'Agentic'],
    readTime: '4 min'
  },
  {
    id: '2',
    category: 'GitHub',
    title: 'FocusEngine: A New Runtime for Long-Horizon Agents',
    excerpt: 'Optimizing for state persistence and context-window management in autonomous agent deployments.',
    content: `
      <p>Deploying agents that can "think" for hours or days requires a fundamentally different runtime. FocusEngine introduces a persistent state layer that survives hardware restarts and token-limit refreshes.</p>
      <h2>Key Features</h2>
      <ul>
        <li><strong>Checkpointing:</strong> Automatic serialization of agent state.</li>
        <li><strong>Dynamic Context Pruning:</strong> Using vector embeddings to actively manage the active window.</li>
        <li><strong>Tool Registry:</strong> A sandboxed environment for tool execution with fine-grained permissions.</li>
      </ul>
      <p>The repository has already seen a 300% increase in stars over the weekend as developers grapple with reliable agentic workflows.</p>
    `,
    date: '2026-04-17',
    author: 'Repo Watch',
    tags: ['Open Source', 'Runtime', 'DevTools'],
    readTime: '6 min'
  },
  {
    id: '3',
    category: 'News',
    title: 'Global AI Safety Summit: The "Silicon Accord" Reached',
    excerpt: 'Major nations and providers agree on standardized stress-testing for models above 10^26 FLOPs.',
    content: `
      <p>In a historic move, representatives from 15 countries and the top 5 AI labs have signed the Silicon Accord. This framework establishes mandatory red-teaming and safety "guardrails" for the next generation of foundation models.</p>
      <p>The Accord focuses on three main pillars: containment, transparency, and recursive oversight.</p>
      <h2>Implications for the Market</h2>
      <p>While some argue this slows innovation, major players believe it provides the regulatory certainty needed for institutional capital to fully enter the space.</p>
    `,
    date: '2026-04-19',
    author: 'Macro Desk',
    tags: ['Safety', 'Regulation', 'Macro'],
    readTime: '3 min'
  },
  {
    id: '4',
    category: 'Minds',
    title: 'Interview: Dr. Elena Voss on Recursive Self-Improvement',
    excerpt: 'The architect behind the Helios-3 model discusses why current hardware is the only limit to self-correction.',
    content: `
      <p>"We aren't looking for a bigger model," says Dr. Voss. "We are looking for a smarter loop."</p>
      <p>In our deep dive, Dr. Voss explains her theory of <strong>Contextual Recursive Refinement</strong>, where models spend more time evaluating their own intermediate thoughts before outputting a final answer.</p>
      <h2>The "Thinking" Tax</h2>
      <p>Voss argues that the true cost of intelligence is not training, but inference-time reasoning. This shifts the focus from parameter counts to <em>Cycle Efficiency</em>.</p>
    `,
    date: '2026-04-15',
    author: 'Interviews',
    tags: ['Research', 'Interviews', 'AGI'],
    readTime: '8 min'
  },
  {
    id: '5',
    category: 'Research',
    title: 'New Paper: Linear Attention is All You Need for 1M+ Context?',
    excerpt: 'ArXiv researchers propose a mapping that reduces quadratic complexity without losing long-term dependency.',
    content: `
      <p>Classical Transformers struggle with ultra-long sequences due to the $O(N^2)$ complexity of attention. This latest research proposes a <em>Linear Kernel Mapping</em> that approximates the attention matrix in $O(N)$ time.</p>
      <h2>Experimental Results</h2>
      <p>The authors demonstrate zero-shot performance on document sets exceeding 2 million tokens, with only a 0.5% drop in perplexity compared to full attention.</p>
    `,
    date: '2026-04-19',
    author: 'ArXiv Daily',
    tags: ['Math', 'Scaling', 'ArXiv'],
    readTime: '5 min'
  }
];
