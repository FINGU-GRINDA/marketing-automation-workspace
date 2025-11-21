import express from 'express';
import { callOpenAIGPT5Generic } from '../aiClient.js';
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

    // OpenAI GPT-5.1로 포맷 생성 요청
    const prompt = `당신은 마케팅 콘텐츠 **포맷 분석 전담 어시스턴트**입니다.
목표는 "레퍼런스 텍스트의 실제 구조와 흐름"을 읽고, 그 패턴을 재사용 가능한 콘텐츠 포맷(JSON)으로 정리하는 것입니다.

입력 정보:
- 채널 유형: ${channelType}
- 타겟 언어: ${targetLanguage}
- 레퍼런스 텍스트: ${referenceText}

분석과 출력에 대한 기본 원칙:

1. **레퍼런스에 충실한 분석**
   - 레퍼런스 텍스트 안에서 실제로 관찰되는 구조, 흐름, 톤, 전략만 포맷에 반영한다.
   - 심리학 용어, 퍼널 용어, 마케팅 프레임워크는 텍스트에서 분명하게 드러날 때만 사용한다.
   - 텍스트와 직접적인 연결이 없는 개념, 이론, 전략을 "내용 채우기 용도"로 억지로 넣지 않는다.

2. **복잡도는 레퍼런스의 분량과 정보량에 맞춘다**
   - 짧고 단순한 텍스트는 소수의 블록으로, 단순한 구조로 정리한다.
   - 길고 복잡한 텍스트는 블록을 더 잘게 나누고, 역할·전략을 더 세분화한다.
   - 항상 "이 텍스트의 정보량과 구조가 어느 정도인지"를 먼저 판단하고, 그에 비례해서 포맷의 디테일을 조절한다.

3. **포맷은 구조와 역할에 집중**
   - 레퍼런스가 실제로 보여주는 요소들을 중심으로 본다
   - 개별 문장 내용이나 도메인 지식은 포맷에 직접 복사하지 않고, **역할과 패턴** 관점에서 추상화한다.

4. **용어 사용의 기준**
   - "감성적 흐름", "전략적 초점" 등은 실제 텍스트의 흐름을 짧게 요약하는 수준으로만 기술한다.
   - "AIDA, PAS, Loss aversion, Authority" 같은 마케팅·심리 용어는, 레퍼런스에 해당 패턴이 명확히 드러날 때만 사용한다.
   - 텍스트와 거리감이 느껴지는 과한 이론/용어는 피하고, 구체적이고 직관적인 표현을 우선 사용한다.

5. **채널과 타겟 언어 고려**
   - ${channelType}와 ${targetLanguage}에 맞게, 블록 이름과 설명을 자연스럽게 맞춘다.
   - 생성될 포맷의 모든 텍스트(블록 이름, 설명, 전략 내용)은 ${targetLanguage}로 작성한다.
   - 언어별 표현 특성과 문화적 맥락을 고려하여 적절한 용어 선택한다.

출력 형식(항상 이 JSON 스키마를 그대로 사용):

{
  "formatName": "포맷 이름을 짧고 명확하게 작성 (${targetLanguage} 텍스트)",
  "formatType": "예: SNS 포스트, 랜딩페이지, 뉴스레터, 세일즈 메일 등",
  "overallStrategy": {
    "funnelStage": "이 포맷이 주로 겨냥하는 퍼널 단계(예: 인지도, 관심, 전환, 리텐션 등)",
    "emotionalArc": "레퍼런스에서 실제로 관찰되는 감정 흐름을 요약",
    "strategicFocus": "설득의 핵심 포인트나 강조 축을 요약",
    "recommendedLength": {
      "minChars": 최소 글자 수: 래퍼런스의 패턴과 유사하며 허용가능한 범위로,
      "maxChars": 최대 글자 수: 래퍼런스의 패턴과 유사하며 허용가능한 범위
    }
  },
  "blocks": [
    {
      "name": "블록 이름 (예: 인트로 훅, 문제 공감, 솔루션 제안, 케이스/증거, CTA 등) - ${targetLanguage} 텍스트로 작성",
      "description": "이 블록의 역할과 기대하는 효과를, 레퍼런스 구조에 맞춰 설명 - ${targetLanguage} 텍스트로 작성",
      "recommendedLength": "채널과 레퍼런스 길이에 맞는 간단한 길이 가이드 (예: 한 단락, 2~3문장 등) - ${targetLanguage} 텍스트로 작성",
      "coreStrategy": "이 블록에서 실제로 사용되는 설득 전략이나 연출 방식 요약 - ${targetLanguage} 텍스트로 작성",
      "keyMoves": [
        "이 블록에서 자주 쓰이는 구체적인 표현 패턴이나 전개 방법 - ${targetLanguage} 텍스트로 작성",
        "예: 문제 상황을 질문 형태로 던지기, 독자의 경험을 상기시키는 한 문장 추가 등 - ${targetLanguage} 텍스트로 작성"
      ],
      "dos": [
        "레퍼런스에서 효과적으로 보이는 점을 바탕으로 이 블록에서 하면 좋은 것 - ${targetLanguage} 텍스트로 작성",
        "톤, 강도, 구체성 등에 대한 간단한 가이드 - ${targetLanguage} 텍스트로 작성"
      ],
      "donts": [
        "레퍼런스의 톤이나 구조와 어긋나는 방식으로 쓰지 않기 위한 주의사항 - ${targetLanguage} 텍스트로 작성",
        "채널 특성상 피해야 할 과도한 길이/톤/정보량 등 - ${targetLanguage} 텍스트로 작성"
      ]
    }
  ]
}`;

    const responseText = await callOpenAIGPT5Generic(prompt);
    const formatData = JSON.parse(responseText);

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
        config: createFormatConfig(formatData, targetLanguage)
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
function createFormatConfig(formatData: any, targetLanguage: string = 'ko'): ContentFormatNodeConfig {
  return {
    kind: 'content_format',
    name: formatData.formatName,
    mappedContentType: formatData.formatType,
    targetLanguage: targetLanguage,
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