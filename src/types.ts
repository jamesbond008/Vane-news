/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Category = 'Investment' | 'GitHub' | 'News' | 'Minds' | 'Research';

export interface Article {
  id: string;
  category: Category;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  tags: string[];
  readTime: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'Person' | 'Project' | 'Organization' | 'Concept';
  description: string;
  link?: string;
}
