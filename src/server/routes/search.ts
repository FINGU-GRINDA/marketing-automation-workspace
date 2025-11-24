import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  SearchNodeConfig,
  SearchQuestion,
  SearchThreadSummary,
  SearchInsight,
  SearchTopicCandidate,
  SearchNodeResult,
  InputNodeConfig,
  ChannelNodeConfig
} from '../types';
import { searchMultiplePlatforms, summarizeTopComments } from '../searchClient.js';

const router = express.Router();

// OpenAI API 키
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OpenAI API 키가 환경 변수에 설정되지 않았습니다.');
}

// GPT-5.1 모델 - 서치 호출은 무조건 gpt-5.1 모델 사용
function getOpenAIModel(requestedModel: string = 'gpt-5.1'): string {
  // 서치 호출은 무조건 gpt-5.1 모델 사용
  if (requestedModel === 'gpt-5.1') {
    console.log(`🚀 서치 노드: gpt-5.1 모델 직접 실행`);
    return 'gpt-5.1';
  }

  return requestedModel;
}

/**
 * 서치 노드 실행 API
 * POST /api/search/execute
 * Body: {
 *   inputNodeId: string,
 *   channelNodeId: string,
 *   searchNodeId: string,
 *   workspaceId: string
 * }
 */
router.post('/execute', async (req, res) => {
  try {
    const { inputNodeId, channelNodeId, searchNodeId, workspaceId } = req.body;

    console.log(`🔍 서치 노드 실행 시작: ${inputNodeId} → ${channelNodeId} → ${searchNodeId}`);

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

    // 2. 노드 데이터 찾기
    const inputNode = workspace.nodes.find((n: any) => n.id === inputNodeId && n.type === 'input');
    const channelNode = workspace.nodes.find((n: any) => n.id === channelNodeId && n.type === 'channel');
    const searchNode = workspace.nodes.find((n: any) => n.id === searchNodeId && n.type === 'search');

    if (!inputNode || !channelNode || !searchNode) {
      return res.status(400).json({ error: '필요한 노드를 찾을 수 없습니다.' });
    }

    const inputConfig = inputNode.data.config as InputNodeConfig;
    const channelConfig = channelNode.data.config as ChannelNodeConfig;
    const searchConfig = searchNode.data.config as SearchNodeConfig;

    // 입력값 유효성 검사
    const inputTopic = inputConfig.topic?.trim() || searchConfig.query?.trim() || '';
    if (!inputTopic) {
      console.error('❌ 유효한 주제가 없습니다. inputConfig.topic:', inputConfig.topic, 'searchConfig.query:', searchConfig.query);
      return res.status(400).json({
        error: '유효한 주제나 검색어가 입력되지 않았습니다.',
        details: {
          inputTopic: inputConfig.topic,
          searchQuery: searchConfig.query,
          message: '입력 노드에 주제를 입력하거나 검색 노드에 검색어를 입력해주세요.'
        }
      });
    }

    console.log(`📊 입력 데이터: "${inputTopic}"`);
    console.log(`📊 입력 전체:`, JSON.stringify(inputConfig, null, 2));
    console.log(`📺 채널: ${channelConfig.name} (${channelConfig.channelType})`);
    console.log(`🔍 서치 설정:`, JSON.stringify(searchConfig, null, 2));

    // 3. AI를 사용한 서치 노드 처리
    const searchResult = await processSearchNode(inputConfig, channelConfig, searchConfig);

    // 4. 검색 결과 저장 (기존 데이터 정리 후 저장)
    if (!searchNode.data.config) {
      searchNode.data.config = searchConfig;
    } else {
      // 기존 오류 데이터 정리
      delete (searchNode.data.config as SearchNodeConfig).searchNodeResult;
    }
    (searchNode.data.config as SearchNodeConfig).searchNodeResult = searchResult;
    (searchNode.data.config as SearchNodeConfig).lastExecutedAt = new Date().toISOString();

    // 5. 기존 콘텐츠 노드에 서치 결과 추가
    const updatedContentNode = await addSearchResultToContentNode(
      searchResult,
      workspace,
      searchNodeId
    );

    if (updatedContentNode) {
      console.log(`✓ 기존 콘텐츠 노드에 서치 결과 추가: ${updatedContentNode.data.label}`);
    } else {
      // 연결된 콘텐츠 노드가 없으면 새로 생성
      const newContentNode = await createContentNodeFromSearchResult(
        searchResult,
        workspace,
        searchNodeId
      );

      if (newContentNode) {
        workspace.nodes.push(newContentNode);
        // 서치 노드와 콘텐츠 노드 연결
        workspace.edges.push({
          id: uuidv4(),
          source: searchNodeId,
          target: newContentNode.id
        });
        console.log(`✓ 새 콘텐츠 노드 생성 및 연결: ${newContentNode.data.label}`);
      }
    }

    // 6. 워크스페이스에 변경사항 저장
    db.workspaces[workspaceId] = workspace;

    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    console.log('✓ 데이터 파일에 저장 완료');

    res.json({
      success: true,
      result: searchResult,
      updatedContentNode: updatedContentNode,
      newContentNode: updatedContentNode ? null : (await createContentNodeFromSearchResult(searchResult, workspace, searchNodeId)),
      message: `서치 노드 실행 완료: ${searchResult.topicCandidates.length}개 주제 후보 생성${updatedContentNode ? ', 기존 콘텐츠 노드에 추가' : ', 새 콘텐츠 노드 생성'}`
    });

  } catch (error) {
    console.error('❌ 서치 노드 실행 오류:', error);
    res.status(500).json({
      error: '서치 노드 실행 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 서치 결과를 기존 콘텐츠 노드에 추가 (ContentNodeConfig 구조에 맞게 수정)
 */
async function addSearchResultToContentNode(
  searchResult: SearchNodeResult,
  workspace: any,
  searchNodeId: string
): Promise<any | null> {
  // 서치 노드에서 콘텐츠 노드로의 엣지 찾기
  const searchToContentEdges = workspace.edges.filter((e: any) => e.source === searchNodeId);

  if (searchToContentEdges.length === 0) {
    console.log('⚠️ 서치 노드에 연결된 콘텐츠 노드가 없습니다.');
    return null;
  }

  // 첫 번째 연결된 콘텐츠 노드 찾기
  const contentNodeId = searchToContentEdges[0].target;
  const contentNode = workspace.nodes.find((n: any) => n.id === contentNodeId && n.type === 'content');

  if (!contentNode) {
    console.log('⚠️ 연결된 콘텐츠 노드를 찾을 수 없습니다.');
    return null;
  }

  // 연결된 채널 정보 가져오기
  const channelEdge = workspace.edges.find((e: any) => e.target === searchNodeId);
  const channelNode = channelEdge ? workspace.nodes.find((n: any) => n.id === channelEdge.source && n.type === 'channel') : null;
  const channelConfig = channelNode?.data?.config as any || {};

  // 검색 결과가 있으면 contentBlocks 구조에 맞게 콘텐츠 노드 업데이트
  if (searchResult.topicCandidates.length > 0) {
    const contentConfig = contentNode.data.config as any;

    // contentBlocks 배열 초기화
    if (!contentConfig.contentBlocks) {
      contentConfig.contentBlocks = [];
    }

    // 서치 결과를 contentBlocks 형식으로 변환하여 추가
    const newContentBlocks = searchResult.topicCandidates.map((topic, idx) => ({
      id: `block_${searchNodeId}_${topic.id}`,
      subject: topic.title,
      content: topic.body || topic.oneLineSummary,
      sources: topic.links || [],
      metadata: {
        channelName: channelConfig.name || '알 수 없음',
        personaTags: channelConfig.personaTags || [],
        questions: topic.basedOnQuestions || [],
        insights: topic.mainInsights || [],
        tags: topic.tags || [],
        sourceNodeId: searchNodeId,
        sourceType: 'ai_search',
        createdAt: new Date().toISOString()
      }
    }));

    // 기존 블록에 새 블록 추가
    contentConfig.contentBlocks = [
      ...contentConfig.contentBlocks,
      ...newContentBlocks
    ];

    // 콘텐츠 노드 기본 정보 업데이트
    contentConfig.title = `수집된 콘텐츠 (${contentConfig.contentBlocks.length}개 블록)`;
    contentConfig.contentType = 'collection';
    contentConfig.status = 'draft';
    contentConfig.tags = [...new Set([
      ...(contentConfig.tags || []),
      ...searchResult.topicCandidates.flatMap(t => t.tags || [])
    ])];

    // 총 블록 수 업데이트
    contentConfig.totalBlocks = contentConfig.contentBlocks.length;
    contentConfig.lastUpdated = new Date().toISOString();

    // 생성/수정 시간 업데이트
    contentConfig.updatedAt = new Date().toISOString();
    if (!contentConfig.createdAt) {
      contentConfig.createdAt = new Date().toISOString();
    }

    // 메타데이터 업데이트
    contentConfig.metadata = {
      ...contentConfig.metadata,
      sourceNodeId: searchNodeId,
      sourceType: 'ai_search',
      channelName: channelConfig.name || '알 수 없음',
      personaTags: channelConfig.personaTags || [],
      wordCount: contentConfig.contentBlocks.reduce((sum: number, block: any) => sum + (block.content?.length || 0), 0),
      estimatedReadTime: Math.max(1, Math.ceil(
        contentConfig.contentBlocks.reduce((sum: number, block: any) => sum + (block.content?.length || 0), 0) / 500
      )),
      generatedAt: new Date().toISOString()
    };

    // 콘텐츠 노드 라벨 업데이트
    contentNode.data.label = contentConfig.title.length > 20
      ? contentConfig.title.substring(0, 20) + '...'
      : contentConfig.title;

    console.log(`✅ 콘텐츠 노드에 ${newContentBlocks.length}개 블록 추가됨 (총 ${contentConfig.contentBlocks.length}개)`);
    console.log(`   - 첫 번째 블록: "${newContentBlocks[0].subject}"`);
    console.log(`   - 태그: ${contentConfig.tags.join(', ')}`);

    return contentNode;
  } else {
    console.log('⚠️ 생성된 콘텐츠가 없습니다.');
    return contentNode;
  }
}

/**
 * 서치 결과로부터 콘텐츠 노드 생성 (ContentNodeConfig 구조에 맞게 수정)
 */
async function createContentNodeFromSearchResult(
  searchResult: SearchNodeResult,
  workspace: any,
  searchNodeId: string
): Promise<any | null> {
  if (!searchResult.topicCandidates || searchResult.topicCandidates.length === 0) {
    console.log('⚠️ 생성된 콘텐츠가 없어 콘텐츠 노드를 생성하지 않습니다.');
    return null;
  }

  // 서치 노드 위치 기준으로 콘텐츠 노드 위치 계산
  const searchNode = workspace.nodes.find((n: any) => n.id === searchNodeId);
  const basePosition = searchNode ? searchNode.position : { x: 700, y: 60 };

  // 연결된 채널 정보 가져오기
  const channelEdge = workspace.edges.find((e: any) => e.target === searchNodeId);
  const channelNode = channelEdge ? workspace.nodes.find((n: any) => n.id === channelEdge.source && n.type === 'channel') : null;
  const channelConfig = channelNode?.data?.config as any || {};

  // 첫 번째 콘텐츠를 주요 콘텐츠로 사용
  const firstContent = searchResult.topicCandidates[0];
  const wordCount = (firstContent.body || firstContent.oneLineSummary || '').length;

  // 서치 결과를 contentBlocks 형식으로 변환
  const contentBlocks = searchResult.topicCandidates.map((topic) => ({
    id: `block_${searchNodeId}_${topic.id}`,
    subject: topic.title,
    content: topic.body || topic.oneLineSummary,
    sources: topic.links || [],
    metadata: {
      channelName: channelConfig.name || '알 수 없음',
      personaTags: channelConfig.personaTags || [],
      questions: topic.basedOnQuestions || [],
      insights: topic.mainInsights || [],
      tags: topic.tags || [],
      sourceNodeId: searchNodeId,
      sourceType: 'ai_search',
      createdAt: new Date().toISOString()
    }
  }));

  const totalWordCount = contentBlocks.reduce((sum, block) => sum + (block.content?.length || 0), 0);

  const newContentNode = {
    id: uuidv4(),
    type: 'content',
    position: {
      x: basePosition.x + 280, // 서치 노드 오른쪽에 배치
      y: basePosition.y
    },
    data: {
      label: `수집된 콘텐츠 (${contentBlocks.length}개 블록)`.length > 20
        ? `수집된 콘텐츠 (${contentBlocks.length}개)`.substring(0, 20) + '...'
        : `수집된 콘텐츠 (${contentBlocks.length}개 블록)`,
      config: {
        kind: 'content' as const,
        title: `수집된 콘텐츠 (${contentBlocks.length}개 블록)`,
        contentType: 'collection' as const,
        status: 'draft' as const,
        tags: [...new Set(searchResult.topicCandidates.flatMap(t => t.tags || []))],
        contentBlocks: contentBlocks,
        totalBlocks: contentBlocks.length,
        lastUpdated: new Date().toISOString(),
        metadata: {
          wordCount: totalWordCount,
          estimatedReadTime: Math.max(1, Math.ceil(totalWordCount / 500)),
          priority: 'medium' as const,
          sourceNodeId: searchNodeId,
          sourceType: 'ai_search',
          channelName: channelConfig.name || '알 수 없음',
          personaTags: channelConfig.personaTags || [],
          generatedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    width: 150,
    height: 80,
    selected: false,
    dragging: false
  };

  console.log(`✅ 새 콘텐츠 노드 생성 완료: "${firstContent.title}"`);
  console.log(`   - 본문 길이: ${wordCount}자`);
  console.log(`   - 태그: ${(firstContent.tags || []).join(', ')}`);

  return newContentNode;
}

/**
 * 1단계: 채널 분석 기반 질문 생성 (AI)
 */
async function generateQuestionsFromChannel(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  searchConfig: SearchNodeConfig
): Promise<SearchQuestion[]> {
  console.log(`🔍 1단계: 채널 분석 기반 질문 생성 시작...`);

  // 입력값 유효성 검사
  const inputTopic = inputConfig.topic?.trim() || searchConfig.query?.trim() || '';
  if (!inputTopic) {
    console.error('❌ 입력된 주제가 없습니다. inputConfig.topic:', inputConfig.topic, 'searchConfig.query:', searchConfig.query);
    throw new Error('유효한 주제나 검색어가 입력되지 않았습니다.');
  }

  console.log(`✅ 유효성 검사 통과. 입력 주제: "${inputTopic}"`);

  const prompt = `
당신은 세계 최고 수준의 마케팅 리서처입니다. 아래 채널 정보를 깊이 분석하여 타겟 청중이 정말 궁금해하고 공감할 만한 질문을 생성해주세요.

## 채널 분석 정보
### 주제/아이디어
${inputTopic}

### 채널 정보
- **플랫폼**: ${channelConfig.channelType}
- **채널명**: ${channelConfig.name}
- **페르소나**: ${channelConfig.personaTags.join(', ')}
- **톤앤매너**: ${channelConfig.toneTags.join(', ')}
- **타겟 청중**: ${channelConfig.highLevelContentTags.join(', ')}
- **금지 주제**: ${channelConfig.prohibitedTypes.join(', ')}

## 요구사항
위 채널의 주요 독자들이 정말 궁금해하고 공감할 만한 질문을 **3-7개** 생성하세요.
- 질문은 ${channelConfig.toneTags.join(', ')} 톤에 맞게 작성
- 타겟 청중(${channelConfig.highLevelContentTags.join(', ')})의 실제 고민사항을 반영
- 페르소나(${channelConfig.personaTags.join(', ')})의 전문성을 고려
- 각 질문은 실제 검색 가능한 구체적인 형태

## 출력 형식 (반드시 JSON만 출력):
\`\`\`json
{
  "questions": [
    {
      "id": "q1",
      "question": "구체적이고 공감 가는 질문"
    }
  ]
}
\`\`\`
`;

  try {
    const requestData = {
      model: getOpenAIModel('gpt-5.1'),
      messages: [
        {
          role: 'system',
          content: '당신은 전문적인 마케팅 리서처이며, 타겟 청중의 심리를 파악하여 효과적인 질문을 생성하는 데 특화되어 있습니다. 항상 JSON 형식으로 정확한 결과를 제공합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    console.log(`🔍 gpt-5.1 API 요청: ${JSON.stringify(requestData, null, 2)}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ gpt-5.1 API 응답 에러 (상태: ${response.status}):`);
      console.error(`에러 내용:`, errorText);
      throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[1]);
      console.log(`✅ 1단계 완료: ${result.questions.length}개 질문 생성`);
      return result.questions;
    } else {
      throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('❌ 1단계 질문 생성 오류:', error);
    // 실패 시 기본 질문 반환
    const fallbackTopic = inputTopic || '일반적인 마케팅';
    return [
      { id: 'q1', question: `${fallbackTopic}에 대한 기본 질문` }
    ];
  }
}

/**
 * 2단계: 실제 API 기반 검색 실행
 */
async function performRealSearch(
  questions: SearchQuestion[],
  platforms: string[]
): Promise<SearchInsight[]> {
  console.log(`🔍 2단계: 실제 API 기반 검색 시작...`);

  const insights: SearchInsight[] = [];

  for (const question of questions) {
    try {
      console.log(`📊 검색 중: "${question.question}" (${platforms.join(', ')})`);

      // 실제 API 검색 실행
      const searchResults = await searchMultiplePlatforms(
        question.question,
        platforms,
        { limit: 5, sort: 'relevance', time: 'month' }
      );

      if (searchResults.length > 0) {
        // 검색 결과를 SearchInsight 형식으로 변환
        const threads = searchResults.flatMap(result =>
          (result.threads || []).map(thread => {
            const content = thread.content || thread.title || '내용 없음';
            const topComments = thread.topComments || [];
            const topCommentText = topComments.length > 0
              ? topComments.slice(0, 2).join(' | ')
              : content.substring(0, 80);

            return {
              title: thread.title || '제목 없음',
              url: thread.url || '',
              summary: content.substring(0, 100) + '...',
              topCommentSummary: topCommentText
            };
          })
        );

        // 핵심 인사이트 추출
        const avgScore = searchResults.reduce((sum, r) => {
          const firstThreadScore = r.threads?.[0]?.score || 0;
          return sum + firstThreadScore;
        }, 0) / Math.max(searchResults.length, 1);
        const keyTakeaways = [
          `검색 결과 ${searchResults.length}개 플랫폼 발견: ${question.question}`,
          `주요 플랫폼: ${platforms.join(', ')}`,
          `평균 참여도: ${avgScore.toFixed(1)}`
        ];

        insights.push({
          questionId: question.id,
          queryUsed: question.question,
          threads,
          keyTakeaways
        });

        console.log(`✅ 검색 완료: ${question.id} - ${searchResults.length}개 결과`);
      } else {
        // 검색 결과가 없을 경우
        insights.push({
          questionId: question.id,
          queryUsed: question.question,
          threads: [{
            title: '검색 결과 없음',
            url: '',
            summary: '해당 질문에 대한 검색 결과를 찾을 수 없습니다.',
            topCommentSummary: '추가 검색이 필요합니다.'
          }],
          keyTakeaways: ['검색 결과 없음 - 키워드 수정 필요']
        });
        console.log(`⚠️ 검색 결과 없음: ${question.id}`);
      }
    } catch (error) {
      console.error(`❌ 검색 오류 (${question.id}):`, error);
      // 실패 시 기본 인사이트 추가
      insights.push({
        questionId: question.id,
        queryUsed: question.question,
        threads: [{
          title: '검색 오류',
          url: '',
          summary: '검색 중 오류가 발생했습니다.',
          topCommentSummary: '다른 방식으로 접근이 필요합니다.'
        }],
        keyTakeaways: ['검색 오류 발생']
      });
    }
  }

  console.log(`✅ 2단계 완료: 총 ${insights.length}개 검색 인사이트 생성`);
  return insights;
}

/**
 * 3단계: 질문과 실제 검색 결과 기반 완성된 콘텐츠 생성 (AI)
 */
async function generateCompleteContent(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  searchConfig: SearchNodeConfig,
  questions: SearchQuestion[],
  insights: SearchInsight[]
): Promise<SearchTopicCandidate[]> {
  console.log(`🔍 3단계: 질문과 검색 결과 기반 완성된 콘텐츠 생성 시작...`);

  // 입력값 유효성 검사
  const inputTopic = inputConfig.topic?.trim() || searchConfig.query?.trim() || '';
  if (!inputTopic) {
    console.error('❌ 입력된 주제가 없습니다. 콘텐츠 생성을 건너뜁니다.');
    return [];
  }

  const prompt = `
전문 콘텐츠 제작자입니다. **${channelConfig.channelType}** 플랫폼용 완성된 콘텐츠 3개를 생성해주세요.

## 채널 정보
- 플랫폼: ${channelConfig.channelType}
- 톤앤매너: ${channelConfig.toneTags.join(', ')}
- 타겟: ${channelConfig.highLevelContentTags.join(', ')}

## 분석 결과
### 질문:
${questions.slice(0, 3).map(q => `- ${q.question}`).join('\n')}

### 핵심 인사이트:
${insights.slice(0, 3).map(insight => `
- ${insight.queryUsed}
  ${insight.keyTakeaways.slice(0, 2).map(t => `  • ${t}`).join('\n')}
`).join('\n')}

## 요구사항
각 콘텐츠는:
1. **제목**: 50자 이내, 클릭 유도
2. **요약**: 핵심 가치 한 줄로
3. **본문**: 최소 300자
   - 흥미로운 도입
   - 2-3개 핵심 섹션 (구체적 팁/사례)
   - 명확한 행동 유도

${channelConfig.channelType === 'linkedin' ? `
**LinkedIn 특성**:
- 전문적 톤
- 데이터 기반
- 실용적 비즈니스 인사이트
- 글머리 기호 활용
` : ''}

## 출력 형식
\`\`\`json
{
  "contents": [
    {
      "id": "c1",
      "title": "완전한 제목",
      "oneLineSummary": "핵심 가치 요약",
      "body": "완성된 본문...\\n\\n구조화된 내용 포함",
      "basedOnQuestions": ["q1"],
      "basedOnThreads": ["스레드 제목"],
      "mainInsights": ["인사이트 1"],
      "links": ["링크"],
      "tags": ["태그1", "태그2"]
    }
  ]
}
\`\`\`

본문은 실제 게시 가능한 구체적 내용으로 작성하세요.
`;

  try {
    const requestData = {
      model: getOpenAIModel('gpt-5.1'),
      messages: [
        {
          role: 'system',
          content: '당신은 전문적인 콘텐츠 제작가이며, 실제 데이터를 기반으로 즉시 게시 가능한 완성된 콘텐츠를 생성하는 데 특화되어 있습니다. 항상 JSON 형식으로 정확한 결과를 제공합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    console.log(`🔍 gpt-5.1 API 요청 (3단계): ${JSON.stringify(requestData, null, 2)}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ gpt-5.1 API 응답 에러 (3단계, 상태: ${response.status}):`);
      console.error(`3단계 에러 내용:`, errorText);
      throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[1]);
      console.log(`✅ 3단계 완료: ${result.contents.length}개 완성된 콘텐츠 생성`);

      // SearchTopicCandidate 형식으로 변환
      return result.contents.map((item: any, index: number) => ({
        id: item.id || `c${index + 1}`,
        title: item.title,
        oneLineSummary: item.oneLineSummary,
        body: item.body, // 본문 필드 추가
        basedOnQuestions: item.basedOnQuestions || [],
        basedOnThreads: item.basedOnThreads || [],
        mainInsights: item.mainInsights || [],
        links: item.links || [],
        tags: item.tags || []
      }));
    } else {
      throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('❌ 3단계 콘텐츠 생성 오류:', error);
    // 실패 시 기본 콘텐츠 반환
    const fallbackTopic = inputTopic || '마케팅 전략';
    return [
      {
        id: 'c1',
        title: `${fallbackTopic}에 대한 기본 콘텐츠`,
        oneLineSummary: '기본적인 마케팅 인사이트 공유',
        body: `${fallbackTopic}에 대한 기본적인 내용입니다.\\n\\n주요 내용:\\n• 현재 트렌드 분석\\n• 실용적인 팁 공유\\n• 행동 유도\\n\\n더 많은 정보가 필요하시면 댓글로 남겨주세요!`,
        basedOnQuestions: questions.slice(0, 2).map(q => q.id),
        basedOnThreads: insights.slice(0, 2).map(i => i.threads[0]?.title || '제목 없음'),
        mainInsights: ['기본적인 인사이트'],
        links: insights.slice(0, 2).flatMap(i => i.threads.slice(0, 1).map(t => t.url)).filter(Boolean),
        tags: ['마케팅', '인사이트', '전략']
      }
    ];
  }
}

/**
 * AI를 사용한 서치 노드 처리 로직 (파이프라인 구조)
 */
async function processSearchNode(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  searchConfig: SearchNodeConfig
): Promise<SearchNodeResult> {

  console.log(`🤖 AI 서치 노드 파이프라인 처리 시작...`);
  console.log(`🚀 GPT-5.1 모델 사용이 강제 설정되었습니다. 최고 성능으로 처리됩니다.`);

  // 초기 데이터 정리 - 기존 오류 데이터 제거
  if (searchConfig.searchNodeResult) {
    console.log('🧹 기존 searchNodeResult 데이터 정리...');
    delete searchConfig.searchNodeResult;
  }

  // 입력값 유효성 검사
  const inputTopic = inputConfig.topic?.trim() || searchConfig.query?.trim() || '';
  if (!inputTopic) {
    console.error('❌ 유효한 주제가 없습니다. 서치 노드 파이프라인을 중단합니다.');
    throw new Error('유효한 주제나 검색어가 입력되지 않았습니다.');
  }

  console.log(`✅ 파이프라인 시작. 입력 주제: "${inputTopic}"`);
  console.log(`📺 채널: ${channelConfig.name} (${channelConfig.channelType})`);
  console.log(`🔍 검색 플랫폼: ${searchConfig.channels.join(', ')}`);


  try {
    // 1단계: 채널 분석 기반 질문 생성
    const questions = await generateQuestionsFromChannel(inputConfig, channelConfig, searchConfig);

    // 2단계: 실제 API 기반 검색 실행
    const insights = await performRealSearch(questions, searchConfig.channels);

    // 3단계: 질문과 검색 결과 기반 완성된 콘텐츠 생성
    const topicCandidates = await generateCompleteContent(
      inputConfig,
      channelConfig,
      searchConfig,
      questions,
      insights
    );

    const searchResult: SearchNodeResult = {
      questions,
      insights,
      topicCandidates
    };

    console.log(`✅ 파이프라인 완료: ${questions.length}개 질문 → ${insights.length}개 인사이트 → ${topicCandidates.length}개 주제 후보`);
    return searchResult;

  } catch (error) {
    console.error('❌ 파이프라인 처리 오류:', error);

    const errorTopic = inputConfig.topic?.trim() || searchConfig.query?.trim() || '알 수 없는 주제';

    // 실패 시 기본 결과 반환
    const fallbackResult: SearchNodeResult = {
      questions: [
        { id: 'q1', question: `${errorTopic}에 대한 기본 질문` }
      ],
      insights: [
        {
          questionId: 'q1',
          queryUsed: errorTopic,
          threads: [
            {
              title: '기본 스레드',
              url: 'https://example.com',
              summary: '기본 요약',
              topCommentSummary: '기본 댓글 요약'
            }
          ],
          keyTakeaways: ['기본 인사이트']
        }
      ],
      topicCandidates: [
        {
          id: 't1',
          title: `${errorTopic}에 대한 기본 주제`,
          oneLineSummary: '기본 한 줄 요약',
          basedOnQuestions: ['q1'],
          basedOnThreads: ['기본 스레드'],
          mainInsights: ['기본 인사이트'],
          links: ['https://example.com'],
          tags: ['기본']
        }
      ]
    };

    console.log(`🔄 기본 결과 반환: ${fallbackResult.topicCandidates.length}개 주제 후보`);
    return fallbackResult;
  }
}

export default router;