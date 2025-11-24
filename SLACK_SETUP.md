# Slack 연동 설정 가이드

## 방법 1: Slack App 생성 (현재 구현 방식) ⭐ 권장

### 장점

- 실시간으로 메시지 수신
- 자동으로 Input Node 업데이트
- 안정적이고 확장 가능

### 단점

- 설정이 조금 복잡함
- Slack App 생성 필요

### 설정 단계

#### 1. Slack App 생성

1. https://api.slack.com/apps 접속
2. **"Create New App"** 클릭
3. **"From scratch"** 선택
4. App 이름 입력 (예: "Marketing Automation")
5. Workspace 선택
6. **"Create App"** 클릭

#### 2. Event Subscriptions 설정

1. 좌측 메뉴에서 **"Event Subscriptions"** 클릭
2. **"Enable Events"** 토글 ON
3. **Request URL** 입력:
   - 프로덕션: `https://your-domain.com/api/slack/events`
   - 로컬 테스트: `https://your-ngrok-url.ngrok.io/api/slack/events`
4. Slack이 URL 검증 요청을 보냄 (서버 로그에서 확인)
5. **"Subscribe to bot events"** 섹션에서:
   - **"Add Bot User Event"** 클릭
   - `message.channels` 추가
6. **"Save Changes"** 클릭

#### 3. OAuth & Permissions 설정

1. 좌측 메뉴에서 **"OAuth & Permissions"** 클릭
2. **"Scopes"** → **"Bot Token Scopes"** 섹션에서:
   - `channels:history` 추가 (공개 채널용)
   - `channels:read` 추가 (공개 채널용)
   - `groups:history` 추가 (비공개 채널용) ⚠️ **필수**
   - `groups:read` 추가 (비공개 채널용) ⚠️ **필수**
3. 페이지 상단으로 스크롤
4. **"Install to Workspace"** 클릭
5. 권한 승인
6. **중요**: 비공개 채널을 사용하는 경우, 위의 `groups:*` 권한이 반드시 필요합니다!

#### 4. Signing Secret 복사

1. 좌측 메뉴에서 **"Basic Information"** 클릭
2. **"App Credentials"** 섹션에서
3. **"Signing Secret"** 옆의 **"Show"** 클릭
4. 복사

#### 5. 환경 변수 설정

```bash
# .env 파일에 추가
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_WEBHOOK_URL=http://o8s48sssog8gkgwcgw00ccco.107.150.31.159.sslip.io/
SLACK_TARGET_WORKSPACE_ID=default-workspace  # 선택사항
```

#### 6. 채널에 Bot 초대 (비공개 채널의 경우 필수!)

**비공개 채널(Private Channel)을 사용하는 경우:**
1. Slack 채널 `threads-ai-automation` (ID: `C09TF21SBB4`)로 이동
2. 채널에서 `/invite @YourBotName` 입력
   - 예: `/invite @Marketing Automation`
3. 또는 채널 멤버 탭에서 Bot을 직접 추가

**중요 사항:**
- 비공개 채널은 Bot이 **반드시 멤버로 초대**되어야 메시지를 수신할 수 있습니다
- Bot이 채널에 없으면 Events API가 메시지 이벤트를 받지 못합니다
- 공개 채널의 경우 자동으로 이벤트를 받지만, 비공개 채널은 Bot이 멤버여야 합니다

---

## 방법 2: Incoming Webhook (더 간단하지만 제한적)

### 장점

- 설정이 매우 간단
- Slack App 생성 불필요

### 단점

- 단방향만 가능 (메시지 전송만 가능, 수신 불가)
- **현재 구현과 호환되지 않음** (메시지 수신이 필요하므로)

### 참고

이 방법은 메시지를 **보내는** 용도로만 사용 가능합니다. 우리는 Slack에서 **메시지를 받아야** 하므로 이 방법은 적합하지 않습니다.

---

## 방법 3: Slack Bot Token으로 메시지 가져오기 (폴링 방식)

### 장점

- Slack App 필요하지만 Events API보다 간단
- 주기적으로 메시지를 가져옴

### 단점

- 실시간이 아님 (폴링 간격 필요)
- 현재 구현과 다름 (추가 개발 필요)

---

## 현재 구현 확인

현재 코드는 **방법 1 (Slack Events API)**을 사용합니다.

### 확인 방법

```bash
# 서버 시작 후 로그 확인
npm run dev

# 다음 중 하나가 보여야 함:
# ✓ Slack Events API 어댑터 초기화 완료
# 또는
# ⚠️ SLACK_SIGNING_SECRET이 설정되지 않았습니다
```

---

## 빠른 체크리스트

- [ ] Slack App 생성
- [ ] Event Subscriptions 활성화
- [ ] Request URL 설정 (ngrok 또는 실제 도메인)
- [ ] `message.channels` 이벤트 구독
- [ ] `channels:history`, `channels:read` 권한 추가
- [ ] Workspace에 설치
- [ ] Signing Secret 복사
- [ ] `.env` 파일에 `SLACK_SIGNING_SECRET` 설정
- [ ] Bot을 타겟 채널에 초대
- [ ] 서버 재시작
- [ ] 테스트 메시지 전송

---

## 로컬 개발 환경 (ngrok 사용)

### 1. ngrok 설치 및 실행

```bash
# ngrok 설치 (Homebrew)
brew install ngrok

# 또는 https://ngrok.com/download 에서 다운로드

# ngrok 실행
ngrok http 3000
```

### 2. ngrok URL 복사

```bash
Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

### 3. Slack App에 URL 설정

- Event Subscriptions → Request URL
- `https://abc123.ngrok.io/api/slack/events` 입력
- Save Changes

### 4. 주의사항

- ngrok 무료 버전은 URL이 재시작할 때마다 변경됨
- 프로덕션에서는 실제 도메인 사용 권장

---

## 문제 해결

### URL 검증 실패

- 서버가 실행 중인지 확인
- ngrok이 정상 작동하는지 확인
- Request URL이 정확한지 확인 (`/api/slack/events` 포함)
- ngrok 인증 페이지 우회: `--request-header-add "ngrok-skip-browser-warning: true"` 사용

### 메시지가 수신되지 않음

**가장 흔한 원인들:**

1. **Bot이 Workspace에 설치되지 않음**
   - OAuth & Permissions → "Install to Workspace" 완료 확인

2. **Bot이 채널에 없음**
   - Slack 채널 `C09TF21SBB4` → 멤버 탭 → "Marketing Automation" Bot 확인
   - 없으면: `/invite @Marketing Automation`

3. **이벤트 구독 문제**
   - `message.channels` 이벤트가 구독되었는지 확인
   - Event Subscriptions → Subscribe to bot events 확인

4. **채널 ID 불일치**
   - 채널 ID가 `C09TF21SBB4`인지 확인
   - 서버 로그에서 `⏭️  다른 채널` 메시지 확인

### Signing Secret 오류

- `.env` 파일에 올바른 값이 설정되었는지 확인
- 서버 재시작 확인

### 서버 로그 확인

메시지를 보낼 때 서버 로그에서 다음을 확인:

**정상적인 경우:**
```
📥 Slack 이벤트 수신 (디버깅):
   타입: event_callback
   이벤트: message
   채널: C09TF21SBB4

🔔 Slack 메시지 이벤트 수신 (디버깅):
   ...
📨 Slack 메시지 수신: C09TF21SBB4
```

**아무것도 나타나지 않으면:**
- Slack App이 이벤트를 전송하지 않고 있음
- 위 항목들을 다시 확인

---

## 테스트 및 확인

### 테스트 메시지 전송 전 체크리스트

#### 1. Slack App 설정 확인
- ✅ **Enable Events** 토글이 **ON**인지 확인
- ✅ **Request URL**이 올바르게 설정되어 있는지 확인
- ✅ **"Verified ✓"** 표시가 있는지 확인

#### 2. 이벤트 구독 확인
- ✅ `message.channels` 이벤트가 추가되어 있는지 확인

#### 3. Bot 권한 확인
- ✅ `channels:history` 스코프 추가됨 (공개 채널용)
- ✅ `channels:read` 스코프 추가됨 (공개 채널용)
- ✅ `groups:history` 스코프 추가됨 (비공개 채널용) ⚠️ **필수**
- ✅ `groups:read` 스코프 추가됨 (비공개 채널용) ⚠️ **필수**
- ✅ **"Install to Workspace"** 완료됨

#### 4. Bot을 채널에 초대 (비공개 채널 필수!)
**중요**: 비공개 채널의 경우 Bot이 **반드시 멤버로 초대**되어야 메시지를 수신할 수 있습니다!

1. Slack에서 비공개 채널 `threads-ai-automation` (ID: `C09TF21SBB4`)로 이동
2. 채널에서 `/invite @YourBotName` 입력
   - 예: `/invite @Marketing Automation`
3. Bot이 채널 멤버 목록에 나타나는지 확인
4. **비공개 채널은 Bot이 멤버가 아니면 Events API가 메시지를 받지 못합니다!**

### 테스트 메시지 전송

위 항목들이 모두 확인되면:

1. **Slack 채널 `C09TF21SBB4`로 이동**
2. **아무 메시지나 전송** (예: "테스트 메시지입니다")
3. **서버 로그 확인** - 다음 로그가 보여야 합니다:

```bash
📨 Slack 메시지 수신: C09TF21SBB4
   사용자: U1234567890
   텍스트: 테스트 메시지입니다...
✓ Slack 메시지 저장 완료: [message-id]
✓ Input Node 자동 업데이트 완료: [node-id]
✓ 웹훅 전송 성공: http://o8s48sssog8gkgwcgw00ccco.107.150.31.159.sslip.io/
```

### 자동화 동작

메시지를 보내면 **자동으로**:

1. ✅ 메시지가 데이터베이스에 저장됨
2. ✅ 기본 워크스페이스의 첫 번째 Input Node가 자동 업데이트됨
   - `title`: "Slack 메시지 (날짜/시간)"
   - `topic`: 메시지 텍스트 (최대 100자)
   - `rawData`: 전체 메시지 텍스트
3. ✅ 웹훅으로 메시지 전송됨

### API 엔드포인트 테스트

#### Slack 메시지 목록 조회
```bash
curl http://localhost:3000/api/slack/messages
```

#### 특정 메시지 조회
```bash
curl http://localhost:3000/api/slack/messages/{message-id}
```

## 요약

**네, Slack App을 만들어야 합니다!**

하지만 걱정하지 마세요:

1. 무료로 만들 수 있습니다
2. 한 번만 설정하면 됩니다
3. 위 단계를 따라하면 10분 안에 완료됩니다

더 간단한 방법을 원하시면 말씀해주세요!
