import express from 'express';
import type { ContentBlock, ContentNodeConfig } from '../types';

const router = express.Router();

/**
 * 콘텐츠 노드에 블록 추가 API
 * POST /api/content/blocks
 * Body: {
 *   workspaceId: string,
 *   contentNodeId: string,
 *   block: {
 *     subject: string,
 *     content: string,
 *     sources: string[],
 *     metadata?: {
 *       channelName?: string,
 *       personaTags?: string[],
 *       questions?: string[],
 *       insights?: string[],
 *       tags?: string[]
 *     }
 *   }
 * }
 */
router.post('/blocks', async (req, res) => {
  try {
    const { workspaceId, contentNodeId, block } = req.body;

    if (!workspaceId || !contentNodeId || !block) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    if (!block.subject || !block.content) {
      return res.status(400).json({ error: '주제와 내용은 필수 항목입니다.' });
    }

    // 1. 워크스페이스 데이터 로드
    const fs = await import('fs');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), 'data', 'db.json');

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: '워크스페이스 데이터를 찾을 수 없습니다.' });
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const db = JSON.parse(rawData);
    const workspace = db.workspaces[workspaceId] || Object.values(db.workspaces).find((w: any) => w.id === workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: '워크스페이스를 찾을 수 없습니다.' });
    }

    // 2. 콘텐츠 노드 찾기
    const contentNode = workspace.nodes.find((n: any) => n.id === contentNodeId && n.type === 'content');

    if (!contentNode) {
      return res.status(404).json({ error: '콘텐츠 노드를 찾을 수 없습니다.' });
    }

    // 3. 새 블록 생성
    const newBlock: ContentBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subject: block.subject,
      content: block.content,
      sources: block.sources || [],
      sourceType: 'manual' as const,
      createdAt: new Date().toISOString(),
      metadata: {
        channelName: block.metadata?.channelName,
        personaTags: block.metadata?.personaTags || [],
        questions: block.metadata?.questions || [],
        insights: block.metadata?.insights || [],
        tags: block.metadata?.tags || []
      }
    };

    // 4. 콘텐츠 노드에 블록 추가
    const contentConfig = contentNode.data.config as ContentNodeConfig;

    if (!contentConfig.contentBlocks) {
      contentConfig.contentBlocks = [];
    }

    contentConfig.contentBlocks.push(newBlock);
    contentConfig.lastUpdated = new Date().toISOString();
    contentConfig.totalBlocks = contentConfig.contentBlocks.length;
    contentConfig.status = 'draft'; // 상태를 draft로 변경

    // 5. 콘텐츠 노드 라벨 업데이트
    contentNode.data.label = `수집된 콘텐츠 (${contentConfig.contentBlocks.length}개 블록)`;

    // 6. 워크스페이스에 변경사항 저장
    db.workspaces[workspaceId] = workspace;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));

    console.log(`✅ 콘텐츠 노드에 새 블록 추가됨: ${newBlock.subject}`);

    res.json({
      success: true,
      block: newBlock,
      contentNode: {
        id: contentNode.id,
        label: contentNode.data.label,
        totalBlocks: contentConfig.contentBlocks.length
      }
    });

  } catch (error) {
    console.error('❌ 블록 추가 오류:', error);
    res.status(500).json({
      error: '블록 추가 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 콘텐츠 블록 수정 API
 * PUT /api/content/blocks/:blockId
 * Body: {
 *   workspaceId: string,
 *   contentNodeId: string,
 *   block: {
 *     subject?: string,
 *     content?: string,
 *     sources?: string[],
 *     metadata?: {
 *       channelName?: string,
 *       personaTags?: string[],
 *       questions?: string[],
 *       insights?: string[],
 *       tags?: string[]
 *     }
 *   }
 * }
 */
router.put('/blocks/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    const { workspaceId, contentNodeId, block } = req.body;

    if (!workspaceId || !contentNodeId || !block) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    // 1. 워크스페이스 데이터 로드
    const fs = await import('fs');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), 'data', 'db.json');

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: '워크스페이스 데이터를 찾을 수 없습니다.' });
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const db = JSON.parse(rawData);
    const workspace = db.workspaces[workspaceId] || Object.values(db.workspaces).find((w: any) => w.id === workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: '워크스페이스를 찾을 수 없습니다.' });
    }

    // 2. 콘텐츠 노드 찾기
    const contentNode = workspace.nodes.find((n: any) => n.id === contentNodeId && n.type === 'content');

    if (!contentNode) {
      return res.status(404).json({ error: '콘텐츠 노드를 찾을 수 없습니다.' });
    }

    // 3. 블록 찾기 및 수정
    const contentConfig = contentNode.data.config as ContentNodeConfig;

    if (!contentConfig.contentBlocks) {
      return res.status(404).json({ error: '콘텐츠 블록을 찾을 수 없습니다.' });
    }

    const blockIndex = contentConfig.contentBlocks.findIndex((b: ContentBlock) => b.id === blockId);

    if (blockIndex === -1) {
      return res.status(404).json({ error: '해당 블록을 찾을 수 없습니다.' });
    }

    // 4. 블록 정보 업데이트
    const existingBlock = contentConfig.contentBlocks[blockIndex];
    const updatedBlock: ContentBlock = {
      ...existingBlock,
      subject: block.subject || existingBlock.subject,
      content: block.content || existingBlock.content,
      sources: block.sources !== undefined ? block.sources : existingBlock.sources,
      metadata: {
        ...existingBlock.metadata,
        channelName: block.metadata?.channelName || existingBlock.metadata?.channelName,
        personaTags: block.metadata?.personaTags || existingBlock.metadata?.personaTags,
        questions: block.metadata?.questions || existingBlock.metadata?.questions,
        insights: block.metadata?.insights || existingBlock.metadata?.insights,
        tags: block.metadata?.tags || existingBlock.metadata?.tags
      }
    };

    contentConfig.contentBlocks[blockIndex] = updatedBlock;
    contentConfig.lastUpdated = new Date().toISOString();

    // 5. 워크스페이스에 변경사항 저장
    db.workspaces[workspaceId] = workspace;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));

    console.log(`✅ 콘텐츠 블록 수정됨: ${updatedBlock.subject}`);

    res.json({
      success: true,
      block: updatedBlock
    });

  } catch (error) {
    console.error('❌ 블록 수정 오류:', error);
    res.status(500).json({
      error: '블록 수정 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 콘텐츠 블록 삭제 API
 * DELETE /api/content/blocks/:blockId
 * Body: {
 *   workspaceId: string,
 *   contentNodeId: string
 * }
 */
router.delete('/blocks/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    const { workspaceId, contentNodeId } = req.body;

    if (!workspaceId || !contentNodeId) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    // 1. 워크스페이스 데이터 로드
    const fs = await import('fs');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), 'data', 'db.json');

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: '워크스페이스 데이터를 찾을 수 없습니다.' });
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const db = JSON.parse(rawData);
    const workspace = db.workspaces[workspaceId] || Object.values(db.workspaces).find((w: any) => w.id === workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: '워크스페이스를 찾을 수 없습니다.' });
    }

    // 2. 콘텐츠 노드 찾기
    const contentNode = workspace.nodes.find((n: any) => n.id === contentNodeId && n.type === 'content');

    if (!contentNode) {
      return res.status(404).json({ error: '콘텐츠 노드를 찾을 수 없습니다.' });
    }

    // 3. 블록 삭제
    const contentConfig = contentNode.data.config as ContentNodeConfig;

    if (!contentConfig.contentBlocks) {
      return res.status(404).json({ error: '콘텐츠 블록을 찾을 수 없습니다.' });
    }

    const blockIndex = contentConfig.contentBlocks.findIndex((b: ContentBlock) => b.id === blockId);

    if (blockIndex === -1) {
      return res.status(404).json({ error: '해당 블록을 찾을 수 없습니다.' });
    }

    const deletedBlock = contentConfig.contentBlocks[blockIndex];
    contentConfig.contentBlocks.splice(blockIndex, 1);
    contentConfig.lastUpdated = new Date().toISOString();
    contentConfig.totalBlocks = contentConfig.contentBlocks.length;

    // 4. 콘텐츠 노드 라벨 업데이트
    contentNode.data.label = `수집된 콘텐츠 (${contentConfig.contentBlocks.length}개 블록)`;

    // 5. 워크스페이스에 변경사항 저장
    db.workspaces[workspaceId] = workspace;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));

    console.log(`✅ 콘텐츠 블록 삭제됨: ${deletedBlock.subject}`);

    res.json({
      success: true,
      deletedBlockId: blockId,
      remainingBlocks: contentConfig.contentBlocks.length
    });

  } catch (error) {
    console.error('❌ 블록 삭제 오류:', error);
    res.status(500).json({
      error: '블록 삭제 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;