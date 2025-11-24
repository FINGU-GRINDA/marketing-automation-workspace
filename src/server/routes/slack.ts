import express from 'express';
import { createEventAdapter } from '@slack/events-api';
import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { SlackMessage, InputNodeConfig } from '../types.js';
import { analyzeSlackMessage } from '../llm.js';

const router = express.Router();

// 환경 변수
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_CHANNEL_ID = 'C09TF21SBB4'; // 타겟 채널 ID
const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || 'http://o8s48sssog8gkgwcgw00ccco.107.150.31.159.sslip.io/';

// Slack Events API 어댑터 생성 (signing secret이 있는 경우만)
let slackEvents: ReturnType<typeof createEventAdapter> | null = null;

if (SLACK_SIGNING_SECRET) {
  try {
    slackEvents = createEventAdapter(SLACK_SIGNING_SECRET, {
      includeBody: true,
    });
    console.log('✓ Slack Events API 어댑터 초기화 완료');
  } catch (error) {
    console.error('❌ Slack Events API 어댑터 초기화 실패:', error);
  }
} else {
  console.warn('⚠️  SLACK_SIGNING_SECRET이 설정되지 않았습니다. Slack 이벤트를 수신할 수 없습니다.');
}

/**
 * Slack 이벤트 수신 엔드포인트
 * POST /api/slack/events
 */
if (slackEvents) {
  // Slack Events API 미들웨어는 raw body를 직접 처리함
  router.use('/events', slackEvents.expressMiddleware());
} else {
  // Slack 설정이 없을 때는 더미 엔드포인트
  router.post('/events', (req, res) => {
    // URL 검증 요청은 여전히 처리
    if (req.body && typeof req.body === 'object' && req.body.type === 'url_verification') {
      console.log('🔍 Slack URL 검증 요청 (SLACK_SIGNING_SECRET 미설정)');
      res.json({ challenge: req.body.challenge });
      return;
    }
    console.warn('⚠️  Slack 이벤트 수신 시도했으나 SLACK_SIGNING_SECRET이 설정되지 않았습니다.');
    res.status(503).json({ error: 'Slack integration not configured' });
  });
}

/**
 * 메시지 이벤트 처리
 */
if (slackEvents) {
  slackEvents.on('message', async (event: any) => {
  try {
    // 디버깅: 모든 메시지 이벤트 로그
    console.log('\n🔔 Slack 메시지 이벤트 수신 (디버깅):');
    console.log('   채널:', event.channel);
    console.log('   타겟 채널:', SLACK_CHANNEL_ID);
    console.log('   서브타입:', event.subtype || '없음');
    console.log('   봇 ID:', event.bot_id || '없음');
    console.log('   사용자:', event.user || '없음');
    console.log('   텍스트:', event.text?.substring(0, 50) || '없음');

    // 봇 메시지나 서브타입 메시지는 무시
    if (event.subtype || event.bot_id) {
      console.log('   ⏭️  봇 메시지 또는 서브타입 메시지로 인해 무시됨');
      return;
    }

    // 타겟 채널만 처리
    if (event.channel !== SLACK_CHANNEL_ID) {
      console.log(`   ⏭️  다른 채널 (${event.channel})이므로 무시됨`);
      return;
    }

    console.log(`\n📨 Slack 메시지 수신: ${event.channel}`);
    console.log(`   사용자: ${event.user}`);
    console.log(`   텍스트: ${event.text?.substring(0, 100)}...`);

    // Slack 메시지 객체 생성
    const slackMessage: SlackMessage = {
      id: uuidv4(),
      channelId: event.channel,
      channelName: event.channel, // 채널 이름은 나중에 업데이트 가능
      text: event.text || '',
      userId: event.user || '',
      userName: event.user || '', // 사용자 이름은 나중에 업데이트 가능
      timestamp: event.ts || '',
      threadTs: event.thread_ts,
      createdAt: new Date().toISOString(),
      forwarded: false,
    };

    // 데이터베이스에 저장
    db.saveSlackMessage(slackMessage);
    console.log(`✓ Slack 메시지 저장 완료: ${slackMessage.id}`);

    // LLM을 사용하여 메시지 분석 (제목, 주제 추출)
    let analyzedData: { title: string; topic: string };
    try {
      analyzedData = await analyzeSlackMessage(slackMessage.text);
      console.log(`✓ 메시지 분석 완료 - 제목: ${analyzedData.title.substring(0, 30)}...`);
    } catch (error) {
      console.error('❌ 메시지 분석 오류, 기본값 사용:', error);
      // 분석 실패 시 기본값 사용
      analyzedData = {
        title: slackMessage.text.substring(0, 50) || 'Slack 메시지',
        topic: slackMessage.text.substring(0, 100) || 'Slack 메시지',
      };
    }

    // 자동으로 Input Node에 메시지 추가
    try {
      const targetWorkspaceId = process.env.SLACK_TARGET_WORKSPACE_ID || 'default-workspace';
      const workspace = db.getWorkspace(targetWorkspaceId);
      
      if (workspace) {
        // 첫 번째 Input Node 찾기
        const inputNode = workspace.nodes.find((n) => n.type === 'input');
        
        if (inputNode) {
          // Input Node 업데이트 (LLM 분석 결과 사용)
          const inputConfig = inputNode.data.config as InputNodeConfig;
          const updatedConfig: InputNodeConfig = {
            ...inputConfig,
            title: analyzedData.title,
            topic: analyzedData.topic,
            rawData: slackMessage.text, // 전체 메시지 텍스트
          };

          // 노드 업데이트
          const updatedNodes = workspace.nodes.map((node) =>
            node.id === inputNode.id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    config: updatedConfig,
                  },
                }
              : node
          );

          db.updateWorkspace(targetWorkspaceId, {
            nodes: updatedNodes,
          });

          console.log(`✓ Input Node 자동 업데이트 완료: ${inputNode.id}`);
        } else {
          console.log(`⚠️  워크스페이스에 Input Node가 없습니다: ${targetWorkspaceId}`);
        }
      } else {
        console.log(`⚠️  워크스페이스를 찾을 수 없습니다: ${targetWorkspaceId}`);
      }
    } catch (error) {
      console.error('❌ Input Node 자동 업데이트 오류:', error);
      // 에러가 발생해도 웹훅 전송은 계속 진행
    }

    // 웹훅으로 전송
    try {
      const webhookPayload = {
        id: slackMessage.id,
        channelId: slackMessage.channelId,
        text: slackMessage.text,
        userId: slackMessage.userId,
        timestamp: slackMessage.timestamp,
        createdAt: slackMessage.createdAt,
      };

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        console.log(`✓ 웹훅 전송 성공: ${WEBHOOK_URL}`);
        db.updateSlackMessage(slackMessage.id, {
          forwarded: true,
          forwardedAt: new Date().toISOString(),
        });
      } else {
        console.error(`❌ 웹훅 전송 실패: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ 웹훅 전송 오류:', error);
    }
    } catch (error) {
      console.error('❌ Slack 메시지 처리 오류:', error);
    }
  });
}

/**
 * URL 검증 (Slack Events API 요구사항)
 */
if (slackEvents) {
  slackEvents.on('url_verification', (challenge: any, respond: any) => {
    console.log('🔍 Slack URL 검증 요청');
    respond({ challenge: challenge.challenge });
  });
}

/**
 * GET /api/slack/messages
 * 저장된 Slack 메시지 목록 조회
 */
router.get('/messages', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const messages = db.getSlackMessages(limit);
    res.json({ success: true, messages, count: messages.length });
  } catch (error) {
    console.error('Slack 메시지 조회 오류:', error);
    res.status(500).json({ success: false, error: '메시지 조회 실패' });
  }
});

/**
 * GET /api/slack/messages/:id
 * 특정 Slack 메시지 조회
 */
router.get('/messages/:id', (req, res) => {
  try {
    const { id } = req.params;
    const message = db.getSlackMessage(id);
    if (!message) {
      return res.status(404).json({ success: false, error: '메시지를 찾을 수 없습니다' });
    }
    res.json({ success: true, message });
  } catch (error) {
    console.error('Slack 메시지 조회 오류:', error);
    res.status(500).json({ success: false, error: '메시지 조회 실패' });
  }
});

export default router;
