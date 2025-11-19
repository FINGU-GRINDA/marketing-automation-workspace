import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { executeFlow } from '../flowEngine.js';
import { suggestFormats } from '../llm.js';
import type { RunFlowResponse, ChannelNodeConfig, ContentFormatNodeConfig } from '../types.js';

const router = express.Router();

/**
 * GET /api/workspaces
 * 모든 워크스페이스 목록 조회
 */
router.get('/', (_req, res) => {
  const workspaces = db.getAllWorkspaces();
  res.json({ workspaces });
});

/**
 * POST /api/workspaces
 * 새 워크스페이스 생성
 */
router.post('/', (req, res) => {
  const { name, description } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Workspace name is required' });
  }

  const newWorkspace = db.createWorkspace(name, description);
  res.status(201).json({ workspace: newWorkspace });
});

/**
 * GET /api/workspaces/:id
 * 워크스페이스 조회
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const workspace = db.getWorkspace(id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const generatedContents = db.getGeneratedContents(id);

  res.json({
    workspace,
    generatedContents,
  });
});

/**
 * PUT /api/workspaces/:id
 * 워크스페이스 업데이트 (노드/엣지 저장)
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nodes, edges, name, description } = req.body;

  const workspace = db.getWorkspace(id);
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const updated = db.updateWorkspace(id, {
    nodes,
    edges,
    name,
    description,
  });

  res.json({ workspace: updated });
});

/**
 * DELETE /api/workspaces/:id
 * 워크스페이스 삭제
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const workspace = db.getWorkspace(id);
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const deleted = db.deleteWorkspace(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

/**
 * GET /api/workspaces/:id/run
 * 플로우 실행 (SSE 스트리밍) - EventSource용
 */
router.get('/:id/run', async (req, res) => {
  const { id } = req.params;
  const { mode, selectedFormats } = req.query;

  const workspace = db.getWorkspace(id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const executionMode = mode === 'manual' ? 'manual' : 'auto';
    const selectedFormatIds = executionMode === 'manual' && selectedFormats
      ? (selectedFormats as string).split(',')
      : undefined;

    console.log(`\n=== Running flow for workspace: ${workspace.name} (${executionMode} mode) ===`);
    if (selectedFormatIds) {
      console.log(`   선택된 포맷: ${selectedFormatIds.length}개`);
    }

    // 기존 결과 초기화
    db.clearGeneratedContents(id);

    // 플로우 실행 with 콜백
    console.log("[API] /workspaces/:id/run 라우트 진입, executionMode:", executionMode, "selectedFormatIds:", selectedFormatIds);
    const { results, executedPaths, skippedPaths } = await executeFlow(workspace, {
      mode: executionMode,
      selectedFormatIds,
      onPathStart: (path) => {
        // 경로 실행 시작
        res.write(`data: ${JSON.stringify({ type: 'path_start', path })}\n\n`);
      },
      onPathComplete: (path, content) => {
        // 경로 실행 완료
        db.saveGeneratedContent(content);
        res.write(`data: ${JSON.stringify({ type: 'path_complete', path, content })}\n\n`);
      },
    });

    console.log(`=== Flow execution completed: ${results.length} result(s) ===\n`);

    // 완료 이벤트 전송
    const response: RunFlowResponse = {
      success: true,
      results,
      executedPaths,
      skippedPaths,
    };

    res.write(`data: ${JSON.stringify({ type: 'done', response })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Flow execution error:', error);

    const response: RunFlowResponse = {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    res.write(`data: ${JSON.stringify({ type: 'error', response })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/workspaces/:id/run
 * 플로우 실행 (SSE 스트리밍)
 */
router.post('/:id/run', async (req, res) => {
  const { id } = req.params;
  const workspace = db.getWorkspace(id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    console.log(`\n=== Running flow for workspace: ${workspace.name} ===`);

    // 기존 결과 초기화
    db.clearGeneratedContents(id);

    // 플로우 실행 with 콜백
    const { results, executedPaths, skippedPaths } = await executeFlow(workspace, {
      onPathStart: (path) => {
        // 경로 실행 시작
        res.write(`data: ${JSON.stringify({ type: 'path_start', path })}\n\n`);
      },
      onPathComplete: (path, content) => {
        // 경로 실행 완료
        db.saveGeneratedContent(content);
        res.write(`data: ${JSON.stringify({ type: 'path_complete', path, content })}\n\n`);
      },
    });

    console.log(`=== Flow execution completed: ${results.length} result(s) ===\n`);

    // 완료 이벤트 전송
    const response: RunFlowResponse = {
      success: true,
      results,
      executedPaths,
      skippedPaths,
    };

    res.write(`data: ${JSON.stringify({ type: 'done', response })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Flow execution error:', error);

    const response: RunFlowResponse = {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    res.write(`data: ${JSON.stringify({ type: 'error', response })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/workspaces/:id/channels/:channelId/suggest-formats
 * 채널 정보를 기반으로 AI가 포맷 제안
 */
router.post('/:id/channels/:channelId/suggest-formats', async (req, res) => {
  const { id, channelId } = req.params;
  const workspace = db.getWorkspace(id);

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  // 채널 노드 찾기
  const channelNode = workspace.nodes.find((n) => n.id === channelId && n.type === 'channel');
  if (!channelNode) {
    return res.status(404).json({ error: 'Channel node not found' });
  }

  try {
    console.log(`\n=== AI 포맷 제안 요청: ${channelNode.data.label} ===`);
    console.log(`채널 ID: ${channelId}`);
    console.log(`워크스페이스 ID: ${id}`);

    const channelConfig = channelNode.data.config as ChannelNodeConfig;

    // 채널 정보만으로 포맷 제안 (입력 노드 불필요)
    console.log('📌 채널 정보만 사용하여 포맷 제안 시작');

    let suggestions;
    try {
      suggestions = await suggestFormats(channelConfig);
    } catch (error) {
      console.error('❌ 포맷 제안 실패:', error);

      // API 할당량 초과 오류 처리
      if (error instanceof Error && error.message.includes('일일 사용 한도를 초과했습니다')) {
        return res.status(500).json({
          success: false,
          error: 'AI API의 일일 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
        });
      }

      // 기타 오류 처리
      return res.status(500).json({
        success: false,
        error: 'AI 포맷 제안 중 오류가 발생했습니다: ' + error.message
      });
    }

    if (suggestions.length === 0) {
      console.error('❌ 포맷 제안 실패: 빈 결과');
      console.log('채널 정보:', {
        name: channelConfig.name,
        type: channelConfig.channelType,
        hasPersonaTags: channelConfig.personaTags.length > 0,
        hasToneTags: channelConfig.toneTags.length > 0,
        hasContentTags: channelConfig.highLevelContentTags.length > 0,
        hasChannelKnowledge: !!channelConfig.channelKnowledge
      });

      // 더 구체적인 에러 메시지 제공
      let errorMessage = 'AI가 포맷을 제안하지 못했습니다. ';
      if (channelConfig.highLevelContentTags.length === 0 && !channelConfig.channelKnowledge) {
        errorMessage += '콘텐츠 태그나 채널 설명을 추가해주세요. ';
      } else if (channelConfig.personaTags.length === 0) {
        errorMessage += '페르소나 태그를 추가해주세요. ';
      } else if (channelConfig.toneTags.length === 0) {
        errorMessage += '톤 태그를 추가해주세요. ';
      } else {
        errorMessage += '채널 정보를 더 자세히 입력해주세요. ';
      }

      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }

    console.log(`✓ ${suggestions.length}개 포맷 제안 완료`);
    suggestions.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.formatName} (${s.formatType})`);
    });

    // 포맷 노드 생성
    const newFormatNodes = suggestions.map((suggestion, index) => {
      const formatConfig: ContentFormatNodeConfig = {
        kind: 'content_format',
        name: suggestion.formatName,
        mappedContentType: suggestion.formatType,
        formatBlocks: suggestion.blocks.map((block) => ({
          id: uuidv4(),
          title: block.name,
          description: '',
          recommendedLength: block.recommendedLength,
          coreStrategy: block.coreStrategy,
          keyMoves: block.keyMoves,
          dos: block.dos,
          donts: block.donts,
        })),
        formatExampleText: '',
        formatStructureDescription: '',
        overallStrategy: suggestion.overallStrategy,
      };

      return {
        id: uuidv4(),
        type: 'content_format' as const,
        position: {
          x: channelNode.position.x + 300,
          y: channelNode.position.y + (index - 1) * 120,
        },
        data: {
          label: suggestion.formatName,
          config: formatConfig,
        },
      };
    });

    // 엣지 생성 (채널 → 포맷들)
    const newEdges = newFormatNodes.map((formatNode) => ({
      id: uuidv4(),
      source: channelId,
      target: formatNode.id,
    }));

    // 최신 workspace 다시 가져오기 (동시성 문제 방지)
    const latestWorkspace = db.getWorkspace(id);
    if (!latestWorkspace) {
      return res.status(404).json({ error: 'Workspace not found after update' });
    }

    // 워크스페이스 업데이트
    const updatedWorkspace = {
      ...latestWorkspace,
      nodes: [...latestWorkspace.nodes, ...newFormatNodes],
      edges: [...latestWorkspace.edges, ...newEdges],
      updatedAt: new Date().toISOString(),
    };

    const saved = db.updateWorkspace(id, updatedWorkspace);

    console.log(`=== 포맷 노드 ${newFormatNodes.length}개 생성 완료 ===\n`);

    res.json({
      success: true,
      workspace: saved, // 전체 workspace 반환
      formats: newFormatNodes,
      edges: newEdges,
    });
  } catch (error) {
    console.error('Format suggestion error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
