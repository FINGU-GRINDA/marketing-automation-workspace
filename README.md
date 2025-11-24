# Marketing Automation Workspace

AI 기반 노드형 마케팅 콘텐츠 자동화 워크스페이스

## 개요

n8n 스타일의 노드 기반 비주얼 프로그래밍 방식으로, 한 번의 입력으로 여러 채널(LinkedIn, Blog, Instagram 등)에 최적화된 마케팅 콘텐츠를 자동 생성하는 시스템입니다.

### 주요 기능

- **노드 기반 워크플로우**: 드래그 앤 드롭으로 마케팅 파이프라인 구축
- **다채널 지원**: LinkedIn, Blog, Instagram, Twitter 등 다양한 채널
- **AI 콘텐츠 생성**: Claude AI를 활용한 고품질 콘텐츠 자동 생성
- **페르소나 & 톤앤매너**: 채널별 맞춤 설정
- **포맷 템플릿**: 다양한 콘텐츠 구조 (스토리텔링, 가이드, 리스트 등)

## 기술 스택

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Flow
- **Backend**: Node.js + Express + TypeScript
- **AI**: Anthropic Claude API
- **Database**: In-Memory (확장 가능: SQLite + Prisma)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정 (선택사항)

`.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
# Anthropic Claude API (필수)
ANTHROPIC_API_KEY=sk-ant-api03-...

# OpenAI API (선택, DALL-E 이미지 생성용)
OPENAI_API_KEY=sk-...

# Gamma API (선택, 소셜 포스트 생성용)
GAMMA_API_KEY=your_gamma_key

# Slack 연동 (선택)
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_WEBHOOK_URL=http://o8s48sssog8gkgwcgw00ccco.107.150.31.159.sslip.io/
SLACK_TARGET_WORKSPACE_ID=default-workspace

# 서버 포트 (선택, 기본값: 3000)
PORT=3000
```

`.env` 파일에서 `ANTHROPIC_API_KEY`를 설정하세요.
**설정하지 않으면 Mock 모드로 동작합니다.**

### 3. 개발 서버 실행

#### NVM 사용 시 (macOS)

```bash
# NVM 로드
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"

# 서버 시작
npm run dev
```

또는 스크립트 사용:

```bash
./run-dev.sh
```

#### 일반 실행

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

서버 시작 시 다음 로그가 보여야 합니다:

```bash
🚀 Server running on http://localhost:3000
💡 LLM: REAL (Claude Haiku), Image: REAL (DALL-E)
📨 Slack 연동 활성화 (타겟 워크스페이스: default-workspace)
```

## 사용 방법

### 1. 기본 플로우 구축

1. **Input Node**: 좌측 패널에서 주제와 상세 데이터 입력
2. **Channel Node 추가**: 툴바에서 "+ 채널" 클릭
   - Input Node와 연결 (드래그)
   - 채널 설정 (타입, 페르소나, 톤 등)
3. **Content Format Node 추가**: 툴바에서 "+ 포맷" 클릭
   - Channel Node와 연결
   - 포맷 구조 및 예시 입력

### 2. 플로우 실행

1. 헤더의 "▶️ 플로우 실행" 버튼 클릭
2. 우측 패널에서 생성 결과 확인
3. 결과 클릭 → 상세 내용 확인 → 복사 버튼으로 클립보드 복사

### 3. 워크스페이스 저장

- 헤더의 "💾 저장" 버튼으로 현재 상태 저장

## 노드 타입

### Input Node (입력)
- **역할**: 원천 데이터 입력
- **설정**: 주제, 상세 데이터
- **색상**: 🟢 초록색

### Channel Node (채널)
- **역할**: 채널 및 톤앤매너 정의
- **설정**: 채널 타입, 페르소나, 톤 태그, 브랜드 지식
- **색상**: 🔵 파란색

### Content Format Node (포맷)
- **역할**: 콘텐츠 구조 정의 및 생성
- **설정**: 포맷 구조, 예시, 생성 템플릿
- **색상**: 🟣 보라색

## 데이터 플로우

```
Input Node → Channel Node → Content Format Node
     ↓             ↓                  ↓
  원천 데이터   톤앤매너 설정      포맷 & 생성
```

## 프로젝트 구조

```bash
marketing_1/
├── src/
│   ├── server/              # 백엔드
│   │   ├── index.ts         # Express 서버
│   │   ├── types.ts         # 타입 정의
│   │   ├── db.ts            # 인메모리 DB
│   │   ├── llm.ts           # Claude API 연동
│   │   ├── flowEngine.ts    # 플로우 실행 엔진
│   │   └── routes/
│   │       └── workspaces.ts
│   └── client/              # 프론트엔드
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── WorkspacePage.tsx
│       │   ├── Header.tsx
│       │   ├── LeftPanel.tsx
│       │   ├── Canvas.tsx
│       │   ├── RightPanel.tsx
│       │   ├── nodes/       # 커스텀 노드
│       │   └── forms/       # 설정 폼
│       └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## API 엔드포인트

### GET /api/workspaces/:id
워크스페이스 조회

### PUT /api/workspaces/:id
워크스페이스 업데이트 (노드/엣지 저장)

### POST /api/workspaces/:id/run
플로우 실행 (콘텐츠 생성)

## Slack 연동

### 설정 방법

1. Slack App 생성 및 설정:
   - https://api.slack.com/apps 에서 새 앱 생성
   - Event Subscriptions 활성화
   - Request URL: `https://your-domain.com/api/slack/events`
   - Subscribe to bot events: 
     - `message.channels` 추가 (공개 채널용)
     - `message.groups` 추가 (비공개 채널용) ⚠️ **필수**
   - OAuth & Permissions에서:
     - `channels:history`, `channels:read` 추가 (공개 채널용)
     - `groups:history`, `groups:read` 추가 (비공개 채널용) ⚠️ **필수**

2. 환경 변수 설정:

   ```bash
   SLACK_SIGNING_SECRET=your_signing_secret
   SLACK_WEBHOOK_URL=http://o8s48sssog8gkgwcgw00ccco.107.150.31.159.sslip.io/
   SLACK_TARGET_WORKSPACE_ID=default-workspace  # 자동 업데이트할 워크스페이스 ID (선택, 기본값: default-workspace)
   ```

3. 타겟 채널:
   - 기본값: `C09TF21SBB4` (비공개 채널: `threads-ai-automation`)
   - `src/server/routes/slack.ts`에서 `SLACK_CHANNEL_ID` 변경 가능
   - **비공개 채널 사용 시**: Bot을 채널에 초대해야 함 (`/invite @YourBotName`)

### 사용 방법

#### 자동 모드 (기본)

1. Slack 채널 `C09TF21SBB4`에 메시지 전송
2. **자동으로** 기본 워크스페이스의 첫 번째 Input Node가 업데이트됨
3. Input Node의 `title`, `topic`, `rawData`가 자동으로 채워짐

#### 수동 모드 (선택)

1. Input Node 폼에서 "📋 Slack 메시지에서 가져오기" 버튼 클릭
2. 최근 Slack 메시지 목록에서 선택
3. 선택한 메시지가 자동으로 Input Node의 데이터로 채워짐

> **참고**: 자동 업데이트는 `SLACK_TARGET_WORKSPACE_ID` 환경 변수로 지정된 워크스페이스의 첫 번째 Input Node에 적용됩니다.

## 확장 계획

- [x] Slack 연동 (메시지 수신 및 Input Node 연동)
- [ ] SQLite + Prisma 영속성 추가
- [ ] 여러 워크스페이스 지원
- [ ] 실시간 실행 진행률 표시
- [ ] 생성 결과 히스토리 관리
- [ ] 사용자 인증 및 협업 기능
- [ ] 더 많은 채널 및 포맷 템플릿

## 라이선스

MIT

## 문의

이슈가 있거나 제안사항이 있다면 GitHub Issues를 이용해주세요.
