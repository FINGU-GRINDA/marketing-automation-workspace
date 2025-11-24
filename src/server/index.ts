import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import workspacesRouter from './routes/workspaces.js';
import formatRouter from './routes/format.js';
import searchRouter from './routes/search.js';
import contentRouter from './routes/content.js';
import slackRouter from './routes/slack.js';

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname 대체 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 미들웨어
app.use(cors());

// 요청 로깅
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Slack 라우트는 body parser 없이 먼저 등록
// Slack Events API adapter가 raw body를 직접 처리하므로 body parser를 적용하면 안 됨
app.use('/api/slack', slackRouter);

// 나머지 라우트는 JSON 파서 사용
app.use(express.json());

// API 라우트
app.use('/api/workspaces', workspacesRouter);
app.use('/api/format', formatRouter);
app.use('/api/search', searchRouter);
app.use('/api/content', contentRouter);

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 정적 프론트엔드 파일 서빙 (dist/client)
const clientBuildPath = path.resolve(__dirname, '../client');
app.use(express.static(clientBuildPath));

// SPA 라우트 처리: /api 가 아닌 모든 요청은 index.html 반환
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// 404 핸들러 (API용)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 에러 핸들러
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Client served from ${clientBuildPath}`);
  console.log(`💡 Using ${process.env.OPENAI_API_KEY ? 'REAL (OpenAI GPT-5.1)' : 'MOCK'} LLM mode\n`);
  const llmMode = process.env.ANTHROPIC_API_KEY ? 'REAL (Claude Haiku)' : 'MOCK';
  const imageMode = process.env.OPENAI_API_KEY ? 'REAL (DALL-E)' : 'MOCK';
  console.log(`💡 LLM: ${llmMode}, Image: ${imageMode}`);
  if (process.env.SLACK_SIGNING_SECRET) {
    const targetWorkspace = process.env.SLACK_TARGET_WORKSPACE_ID || 'default-workspace';
    console.log(`📨 Slack 연동 활성화 (타겟 워크스페이스: ${targetWorkspace})\n`);
  } else {
    console.log(`📨 Slack 연동 비활성화 (SLACK_SIGNING_SECRET 미설정)\n`);
  }
});
