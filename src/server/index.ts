import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import workspacesRouter from './routes/workspaces.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 요청 로깅
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 라우트
app.use('/api/workspaces', workspacesRouter);

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 핸들러
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
  console.log(`💡 Using ${process.env.GEMINI_API_KEY ? 'REAL (Gemini 2.5 Pro)' : 'MOCK'} LLM mode\n`);
});
