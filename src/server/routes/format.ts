import express from 'express';
import { callOpenAIGPT5 } from '../llm.js';
import { db } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import type { Node, ContentFormatNodeConfig } from '../types.js';

const router = express.Router();

/**
 * POST /api/format/from-reference
 * 레퍼런스 텍스트를 기반으로 AI가 포맷을 자동 생성
 */
router.post('/from-reference', async (req, res) => {
  try {
    const { channelId, channelType, referenceText, targetLanguage = 'ko', workspaceId } = req.body;

    // 필수 파라미터 검증
    if (!channelId || !channelType || !referenceText || !workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'channelId, channelType, referenceText, workspaceId는 필수 항목입니다.'
      });
    }

    console.log(`\n=== AI 포맷 생성 요청: 채널 ${channelId} (${channelType}) ===`);
    console.log(`타겟 언어: ${targetLanguage}`);
    console.log(`레퍼런스 텍스트 길이: ${referenceText.length}자`);
    console.log(`워크스페이스 ID: ${workspaceId}`);

    // GPT-5로 포맷 생성 요청
    const formatData = await callOpenAIGPT5(channelType, referenceText, targetLanguage);

    console.log(`✓ AI 포맷 생성 완료: ${formatData.formatName}`);

    // 포맷 노드 생성 및 엣지 연결
    const workspace = db.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: '워크스페이스를 찾을 수 없습니다.'
      });
    }

    // 채널 노드 확인
    const channelNode = workspace.nodes.find((n: Node) => n.id === channelId);
    if (!channelNode) {
      return res.status(404).json({
        success: false,
        error: '채널 노드를 찾을 수 없습니다.'
      });
    }

    // 새 포맷 노드 생성
    const formatNodeId = uuidv4();
    const formatNode: Node = {
      id: formatNodeId,
      type: 'content_format',
      position: {
        x: channelNode.position.x + 300, // 채널 노드의 오른쪽에 위치
        y: channelNode.position.y
      },
      data: {
        label: formatData.formatName,
        config: createFormatConfig(formatData)
      },
      style: {
        width: 150,
        height: 80,
        backgroundColor: '#f8fafc',
        border: '2px solid #e2e8f0',
        borderRadius: '8px'
      }
    };

    // 엣지 생성 (채널 → 포맷)
    const edgeId = uuidv4();
    const edge = {
      id: edgeId,
      source: channelId,
      target: formatNodeId,
      type: 'smoothstep',
      style: { stroke: '#8b5cf6', strokeWidth: 2 }
    };

    // 워크스페이스에 노드와 엣지 추가
    db.addNode(workspaceId, formatNode);
    db.addEdge(workspaceId, edge);

    console.log(`✓ 포맷 노드 생성 및 연결 완료: ${formatNode.id} → ${formatNodeId}`);

    res.json({
      success: true,
      data: {
        formatData,
        node: formatNode,
        edge: edge
      }
    });

  } catch (error) {
    console.error('AI 포맷 생성 오류:', error);

    res.status(500).json({
      success: false,
      error: '포맷 자동 생성에 실패했습니다. 나중에 다시 시도해 주세요.'
    });
  }
});

/**
 * AI 생성 데이터로 ContentFormatNodeConfig 생성
 */
function createFormatConfig(formatData: any): ContentFormatNodeConfig {
  return {
    kind: 'content_format',
    name: formatData.formatName,
    mappedContentType: formatData.formatType,
    formatBlocks: formatData.blocks.map((block: any) => ({
      id: uuidv4(),
      title: block.name,
      description: block.description || '',
      recommendedLength: block.recommendedLength || '',
      coreStrategy: block.coreStrategy || '',
      keyMoves: block.keyMoves || [],
      dos: block.dos || [],
      donts: block.donts || []
    })),
    formatExampleText: '',
    formatStructureDescription: '',
    overallStrategy: formatData.overallStrategy ? {
      funnelStage: formatData.overallStrategy.funnelStage,
      emotionalArc: formatData.overallStrategy.emotionalArc,
      strategicFocus: formatData.overallStrategy.strategicFocus || '',
      recommendedLength: formatData.overallStrategy.recommendedLength
    } : undefined
  };
}

export default router;