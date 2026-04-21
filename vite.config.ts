import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'child_process';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const NEWS_DB_PATH = path.resolve(__dirname, 'data/vane_news.sqlite');
const ARTICLE_STATUSES = new Set(['collected', 'selected', 'published', 'rejected', 'archived']);

function sqlQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqliteJson<T>(sql: string): T[] {
  const output = execFileSync('sqlite3', ['-json', NEWS_DB_PATH, sql], { encoding: 'utf8' }).trim();
  return output ? JSON.parse(output) as T[] : [];
}

function sqliteExec(sql: string) {
  execFileSync('sqlite3', [NEWS_DB_PATH, sql], { encoding: 'utf8' });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64_000) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function apiPlugin(): Plugin {
  return {
    name: 'vane-news-sqlite-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/news/')) {
          next();
          return;
        }

        try {
          const url = new URL(req.url, 'http://localhost');

          if (req.method === 'GET' && url.pathname === '/api/news/meta') {
            const statuses = sqliteJson<{ status: string; count: number }>(
              'SELECT status, COUNT(*) AS count FROM ai_news_articles GROUP BY status ORDER BY count DESC'
            );
            const sources = sqliteJson<{ source_name: string; count: number }>(
              "SELECT COALESCE(source_name, 'Unknown') AS source_name, COUNT(*) AS count FROM ai_news_articles GROUP BY source_name ORDER BY count DESC"
            );
            const total = sqliteJson<{ count: number }>('SELECT COUNT(*) AS count FROM ai_news_articles')[0]?.count ?? 0;
            sendJson(res, 200, { total, statuses, sources });
            return;
          }

          if (req.method === 'GET' && url.pathname === '/api/news/articles') {
            const page = Math.max(1, Number(url.searchParams.get('page') || 1));
            const limit = Math.min(100, Math.max(10, Number(url.searchParams.get('limit') || 50)));
            const offset = (page - 1) * limit;
            const q = (url.searchParams.get('q') || '').trim();
            const source = (url.searchParams.get('source') || '').trim();
            const status = (url.searchParams.get('status') || '').trim();
            const where: string[] = [];

            if (q) {
              const like = sqlQuote(`%${q}%`);
              where.push(`(title LIKE ${like} OR summary LIKE ${like} OR content LIKE ${like} OR source_name LIKE ${like})`);
            }
            if (source) {
              where.push(`source_name = ${sqlQuote(source)}`);
            }
            if (status) {
              where.push(`status = ${sqlQuote(status)}`);
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const count = sqliteJson<{ count: number }>(`SELECT COUNT(*) AS count FROM ai_news_articles ${whereSql}`)[0]?.count ?? 0;
            const rows = sqliteJson(`
              SELECT
                id,
                source_name,
                source_category,
                title,
                url,
                summary,
                content,
                html,
                image_url,
                language,
                published_at,
                collected_at,
                status,
                score,
                screening_reason,
                tags_json
              FROM ai_news_articles
              ${whereSql}
              ORDER BY COALESCE(published_at, collected_at) DESC, id DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `);
            sendJson(res, 200, { page, limit, total: count, articles: rows });
            return;
          }

          const statusMatch = url.pathname.match(/^\/api\/news\/articles\/(\d+)\/status$/);
          if (req.method === 'PATCH' && statusMatch) {
            const id = Number(statusMatch[1]);
            const body = await readBody(req);
            const status = String(body.status || '').trim();
            if (!Number.isInteger(id) || id <= 0 || !ARTICLE_STATUSES.has(status)) {
              sendJson(res, 400, { error: 'Invalid article id or status' });
              return;
            }
            sqliteExec(`UPDATE ai_news_articles SET status = ${sqlQuote(status)} WHERE id = ${id}`);
            sendJson(res, 200, { id, status });
            return;
          }

          sendJson(res, 404, { error: 'Not found' });
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Unknown API error',
          });
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [apiPlugin(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
