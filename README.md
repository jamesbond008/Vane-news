<div align="center">
<img width="1200" height="475" alt="VANE News banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VANE News

VANE News 是一个面向 AI 投资研究和技术情报筛选的本地新闻工作流。系统会从 RSS 源收集 AI 资讯，写入 SQLite 数据库，再使用 Gemini 根据 Sunday Venture Studio 的情报提示词进行筛选，最后导出到 React 前端展示。

它的核心目标不是做普通新闻聚合，而是把信息流压缩成可行动的技术与投资信号：

- Long-horizon Agent、Agent 记忆、工具调用和可靠性
- 模型架构、推理期计算、长上下文、MoE、世界模型
- RAG、推理成本、Agent runtime、评测和观测基础设施
- 顶级融资、并购、人才迁移和大厂路线变化
- 可能在 3-12 个月内变成战略信号的非共识弱信号

## 功能

- 从 RSS 源 Markdown 导入信息源
- 抓取 RSS/Atom 文章并写入 SQLite
- 自动删除 24 小时前的候选文章
- 用 Gemini 筛选 Strategic Radar / Watchlist / Context Signal
- 将筛选结果导出为前端数据
- 首页用单列阅读流展示中文信号标题
- 数据库管理页支持搜索、筛选和状态管理
- 浅色阅读主题使用柔和纸面色，降低长时间阅读疲劳

## 项目结构

```text
database/schema.sql                     SQLite 表结构
docs/SUNDAY_VENTURE_FILTER_PROMPT.md    Gemini 筛选系统提示词
scripts/import_rss_sources.py           RSS 源 Markdown 导入
scripts/cleanup_old_news.py             24 小时 TTL 清理
scripts/collect_rss_articles.py         RSS/Atom 采集
scripts/screen_with_gemini.py           Gemini 情报筛选
scripts/export_frontend_news.py         前端数据导出
src/components/NewsHome.tsx             首页新闻列表
src/components/ArticleManager.tsx       数据库管理页
src/data/generatedArticles.ts           生成的前端新闻数据
vite.config.ts                          本地新闻 API 中间件
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填入 Gemini API key：

```bash
GEMINI_API_KEY="your_key_here"
GEMINI_MODEL="gemini-2.5-flash"
```

`.env.local` 已被 `.gitignore` 忽略，不会提交到 GitHub。SQLite 数据库和备份文件也被忽略，避免把本地采集数据上传。

## 编译与运行流程

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化 RSS 源

```bash
npm run workflow:import-sources
```

这一步会读取：

```text
/Users/james007/Desktop/新闻工作流/ai新闻工作流制作/AI新闻工作流_RSS源汇总.md
```

并写入：

```text
data/vane_news.sqlite
```

### 3. 清理 24 小时前数据

```bash
npm run workflow:cleanup-24h
```

这一步会删除超过 24 小时的候选文章和关联精选结果。

### 4. 抓取新闻

```bash
npm run workflow:collect
```

采集器会从有效 RSS/Atom 源抓取文章，写入 `ai_news_articles`。

### 5. Gemini 筛选

```bash
npm run workflow:screen-gemini
```

默认参数：

```text
候选文章：120 条
批次大小：20 条
最多输出：12 条
最低分：50
时间范围：24 小时
```

筛选结果会写入 `selected_news`，并按以下等级输出：

```text
80-100  Strategic Radar
60-79   Watchlist
50-59   Context Signal
<50     Drop
```

### 6. 导出前端数据

```bash
npm run workflow:export-frontend
```

这一步会把 `selected_news` 导出到：

```text
src/data/generatedArticles.ts
```

导出时会优先抽取 Gemini memo 中的中文信号标题，因此首页会显示中文标题，而不是英文论文原题。

### 7. 一键运行完整新闻工作流

```bash
npm run workflow:run
```

等价于：

```text
cleanup-24h -> import-sources -> collect -> screen-gemini -> export-frontend
```

### 8. 类型检查

```bash
npm run lint
```

当前验证结果：

```text
tsc --noEmit passed
```

### 9. 生产构建

```bash
npm run build
```

当前构建结果：

```text
vite v6.4.2 building for production
2083 modules transformed
dist/index.html generated
dist/assets/*.css generated
dist/assets/*.js generated
build passed
```

### 10. 本地启动

```bash
npm run dev
```

或者固定在当前工作流使用的端口：

```bash
./node_modules/.bin/vite --host=0.0.0.0 --port=3002 --strictPort
```

访问：

```text
http://localhost:3002/
```

## 数据库管理

启动前端后点击顶部导航的 `DB`，可以进入候选新闻数据库管理页。

本地 API：

```text
GET /api/news/meta
GET /api/news/articles?page=1&limit=50&q=&source=&status=
PATCH /api/news/articles/:id/status
```

## 安全说明

以下内容不会提交到 GitHub：

```text
.env.local
.env
data/*.sqlite
data/backups/
node_modules/
.npm-cache/
.pycache/
dist/
```

提交前请确认不要把任何真实 API key 写入 `.env.example`、README 或源码。
