import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import workspacesRouter from './routes/workspaces.js';

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname 대체 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 미들웨어
app.use(cors());
app.use(express.json());

// 요청 로깅
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API 라우트
app.use('/api/workspaces', workspacesRouter);

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
  console.log(`💡 Using ${process.env.GEMINI_API_KEY ? 'REAL (Gemini 2.5 Pro)' : 'MOCK'} LLM mode\n`);
});
