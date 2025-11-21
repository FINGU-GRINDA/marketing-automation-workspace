import { callOpenAIGPT5Generic } from './aiClient.js';
import type {
  InputNodeConfig,
  ChannelNodeConfig,
  ContentFormatNodeConfig,
} from './types.js';

// 환경 변수에서 API 키 가져오기
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GAMMA_API_KEY = process.env.GAMMA_API_KEY;

// API 키 설정 확인
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
  throw new Error('OPENAI_API_KEY 환경 변수가 필요합니다.');
}

/**
 * 생성 컨텍스트 구성 함수
 */
function buildGenerationContext(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig,
  targetLanguage?: string
): object {
  // 포맷에 저장된 targetLanguage 사용, 없으면 inputConfig의 targetLanguage 사용
  const finalTargetLanguage = targetLanguage || formatConfig.targetLanguage || inputConfig.targetLanguage || 'ko';

  const generationContext = {
    inputData: {
      topic: inputConfig.topic,
      rawData: inputConfig.rawData,
      title: inputConfig.title || inputConfig.topic,
      message: inputConfig.message || '',
      targetLanguage: finalTargetLanguage,
    },
    contentFormat: formatConfig,
    channel: channelConfig,
    forbidden: {
      prohibitedTypes: channelConfig.prohibitedTypes ?? [],
      explicitBans: [
        "inputData와 channel.channelKnowledge에 없는 구체적인 수치나 사례를 만들어내지 말 것",
        "toneMannerExample의 문장을 직접 복사하지 말 것",
        "금지된 콘텐츠 유형을 절대 사용하지 말 것"
      ]
    }
  };

  return generationContext;
}

/**
 * 1단계: 포스트 전략 플랜 생성
 * contentFormat과 channel 정보를 바탕으로 블록별 전략 플랜 설계
 */
export async function planPostFromContext(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<any> {
  console.log('🎯 [1단계] 포스트 전략 플랜 생성 시작...');

  const generationContext = buildGenerationContext(inputConfig, channelConfig, formatConfig);
  const systemPrompt = buildSystemPrompt(channelConfig, inputConfig.targetLanguage);

  const planningPrompt = `${systemPrompt}

아래는 이번 글 생성에 사용될 컨텍스트이다.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

위 정보를 바탕으로, "최종 글 초안"이 아니라
"블록별 전략 플랜"만 JSON 형식으로 설계하라.

출력 형식은 다음과 같다.

{
  "overallPlan": {
    "targetLengthChars": { "min": number, "max": number },
    "mainAngle": string,
    "keyMessages": string[]
  },
  "blocks": [
    {
      "blockId": string,
      "title": string,
      "role": string,
      "plannedLengthChars": number,
      "messages": string[],
      "toneHints": string[],
      "riskNotes": string[]
    }
  ]
}

블록별 세부사항:
- role: 이 블록의 역할과 목적
- messages: 이 블록에서 전달할 핵심 메시지 목록 (구체적인 표현 포함)
- toneHints: 톤앤매너 적용을 위한 구체적 힌트
- riskNotes: 작성 시 주의할 점이나 위험 요소

각 블록의 실제 글 내용을 작성하는 것이 아니라,
전체적인 구조와 전략만 설계하라.
`;

  try {
    const responseText = await callOpenAIGPT5Generic(planningPrompt);
    console.log('✅ [1단계] 전략 플랜 생성 완료');

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('⚠️ [1단계] JSON 파싱 실패, 원본 텍스트 반환');
      console.error('Parse error:', parseError);
      return {
        planText: responseText,
        error: "JSON 파싱 실패"
      };
    }
  } catch (error) {
    console.error('❌ [1단계] 전략 플랜 생성 실패:', error);
    throw error;
  }
}

/**
 * 2단계: 전략 기반 초안 생성
 * 1단계에서 설계한 전략 플랜을 바탕으로 블록별 글쓰기 진행
 */
async function generatePostFromPlan(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig,
  plan: any
): Promise<string> {
  console.log('📝 [2단계] 전략 기반 초안 생성 시작...');

  const generationContext = buildGenerationContext(inputConfig, channelConfig, formatConfig);
  const systemPrompt = buildSystemPrompt(channelConfig, inputConfig.targetLanguage);

  const draftingPrompt = `${systemPrompt}

아래는 이번 글 생성에 사용될 컨텍스트와 1단계에서 설계한 전략 플랜이다.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

전략 플랜:
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

위 전략 플랜을 바탕으로 전체 글을 작성하라.
각 블록의 지침을严格遵守하고, 톤앤매너를 일관되게 적용하라.

다음 형식으로 작성하라:

\`\`\`markdown
${formatConfig.formatBlocks.map(block => `## ${block.title}

${block.description || ''}

(여기에 이 블록의 내용을 작성)

`).join('\n')}
\`\`\`

주의사항:
- 각 블록의 역할과 목적에 맞게 내용을 작성
- 전체 글의 흐름이 자연스럽게 연결되도록 구성
- 톤앤매너 예시를 참고하여 일관된 스타일 유지
- 금지된 콘텐츠 유형은 절대 사용하지 말 것
- inputData와 channelKnowledge에 없는 구체적인 수치나 사례를 만들어내지 말 것
`;

  try {
    const responseText = await callOpenAIGPT5Generic(draftingPrompt);
    console.log('✅ [2단계] 초안 생성 완료');
    return responseText;
  } catch (error) {
    console.error('❌ [2단계] 초안 생성 실패:', error);
    throw error;
  }
}

/**
 * 3단계: 최종 글 다듬기 및 포맷팅
 * 생성된 초안을 검토하고 최종 형태로 다듬기
 */
async function generateFinalDraftFromPlan(
  _inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  _formatConfig: ContentFormatNodeConfig,
  _plan: any,
  draft: string
): Promise<string> {
  console.log('✨ [3단계] 최종 글 다듬기 시작...');

  const systemPrompt = buildSystemPrompt(channelConfig, _inputConfig.targetLanguage);

  const polishingPrompt = `${systemPrompt}

아래는 이번 글 생성에 사용된 모든 정보와 생성된 초안이다.

초안:
\`\`\`
${draft}
\`\`\`

위 초안을 검토하고 다음 기준에 따라 다듬어라:

1. 전체 구조와 흐름의 자연스러움
2. 톤앤매너의 일관성
3. 각 블록의 목적과 역할 부합도
4. 표현의 명확성과 매력도
5. 채널 특성과 타겟 고객 적합성

다듬기 과정에서:
- 불필요한 중복이나 비효율적인 표현 정리
- 더 자연스러운 문장 연결로 흐름 개선
- 핵심 메시지가 잘 드러나도록 강화
- 채널 특성에 맞는 표현으로 최적화

최종 결과물만 출력하라. 다른 설명이나 분석은 포함하지 말고, 깔끔하게 다듬어진 최종 글만 반환하라.
`;

  try {
    const responseText = await callOpenAIGPT5Generic(polishingPrompt);
    console.log('✅ [3단계] 최종 글 다듬기 완료');
    return responseText;
  } catch (error) {
    console.error('❌ [3단계] 최종 글 다듬기 실패:', error);
    // 실패 시 초안을 반환
    console.log('⚠️ [3단계] 실패하여 초안을 반환합니다.');
    return draft;
  }
}


/**
 * 시스템 프롬프트 생성
 */
function buildSystemPrompt(channelConfig: ChannelNodeConfig, targetLanguage?: string): string {
  const toneExample = channelConfig.toneMannerExample;
  const prohibitedTypesText = channelConfig.prohibitedTypes.length > 0
    ? `금지된 콘텐츠 유형: ${channelConfig.prohibitedTypes.join(', ')}`
    : '';

  const systemPrompt = `당신은 전문 마케팅 콘텐츠 제작자입니다.

채널 정보:
- 채널명: ${channelConfig.name}
- 채널 유형: ${channelConfig.channelType}
- 페르소나: ${channelConfig.personaTags.join(', ')}
- 톤앤매너: ${channelConfig.toneTags.join(', ')}
- 콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ')}
- 타겟 언어: ${targetLanguage || 'ko'}
${toneExample ? `- 톤앤매너 예시: "${toneExample}"` : ''}
${prohibitedTypesText ? `- ${prohibitedTypesText}` : ''}

채널 지식:
${channelConfig.channelKnowledge || '없음'}

요구사항:
1. 채널의 페르소나와 톤앤매너를 정확히 반영
2. 제공된 데이터와 지식만 사용
3. 금지된 콘텐츠 유형은 절대 사용하지 않음
4. 톤앤매너 예시를 참고하여 일관된 스타일 유지
5. 타겟 언어에 맞는 자연스러운 표현 사용
6. 마케팅 목적에 부합하는 설득력 있는 콘텐츠 작성
7. 각 블록의 역할과 목적을 정확히 이해하고 반영
8. 블록 간의 자연스러운 흐름과 연결성 확보`;

  return systemPrompt;
}

/**
 * 포스트 생성 메인 함수 - 개선된 3단계 프로세스
 */
export async function callLLM(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<string> {
  try {
    console.log('🚀 포스트 생성 시작 (3단계 프로세스)...');
    console.log('📊 입력 데이터:', {
      topic: inputConfig.topic,
      channel: channelConfig.name,
      format: formatConfig.name
    });

    // 1단계: 전략 플랜 생성
    const plan = await planPostFromContext(inputConfig, channelConfig, formatConfig);

    // 2단계: 초안 생성
    const draft = await generatePostFromPlan(inputConfig, channelConfig, formatConfig, plan);

    // 3단계: 최종 글 다듬기
    const finalDraft = await generateFinalDraftFromPlan(inputConfig, channelConfig, formatConfig, plan, draft);

    console.log('✅ 포스트 생성 완료');
    return finalDraft;

  } catch (error) {
    console.error('❌ 포스트 생성 실패:', error);
    throw error;
  }
}

/**
 * 포스트 생성 메인 함수 - 1회성 싱글 플로우 프로세스
 */
export async function callLLM_SingleFlow(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig,
  targetLanguage?: string
): Promise<string> {
  try {
    console.log('🚀 포스트 생성 시작 (1회성 싱글 플로우)...');
    console.log('📊 입력 데이터:', {
      topic: inputConfig.topic,
      channel: channelConfig.name,
      format: formatConfig.name
    });

    // 포맷에 저장된 targetLanguage 사용, 없으면 inputConfig의 targetLanguage 사용
    const finalTargetLanguage = targetLanguage || formatConfig.targetLanguage || inputConfig.targetLanguage || 'ko';
    const generationContext = buildGenerationContext(inputConfig, channelConfig, formatConfig, finalTargetLanguage);
    const systemPrompt = buildSystemPrompt(channelConfig, finalTargetLanguage);

    const singleFlowPrompt = `${systemPrompt}

컨텍스트에 포함된 정보(채널 설정, 톤앤매너, 입력 데이터, 채널 지식, 선택된 포맷/블록 정보 등)에만 의존해서, 마케팅 콘텐츠를 작성하라.

**작성 규칙:**

**언어 설정**
- 생성할 콘텐츠의 언어는 inputData의 targetLanguage에 명시된 언어를 반드시 따라야 한다.
- 한국어(ko)로 설정된 경우 한국어로, 영어(en)로 설정된 경우 영어로, 해당 언어로 콘텐츠를 생성한다.
- 언어 설정과 관계없이 다른 언어로 생성하지 말고, 지정된 언어로만 작성한다.

**데이터 출처**
- 사용 가능한 정보는 generationContext와 systemPrompt 안에 있는 내용으로 한정한다.
- inputData, channelKnowledge, format/blocks 등 실제로 주어진 데이터만 활용한다.
- 제공되지 않은 수치·사례·연구·인용은 만들어내지 않는다.

**구조**
- generationContext에 포맷/블록 구조가 정의되어 있다면, 그 구조를 우선적으로 따른다.
- 예: 블록 이름, 설명, 순서가 있다면 해당 순서를 기준으로 섹션을 구성한다.
- 포맷/블록 정의가 없거나 단순한 경우, 채널 유형과 입력 콘텐츠 성격에 맞는 기본적인 섹션 구조만 가볍게 잡는다.
- 설계된 블록수와 다르게 블록 수를 늘리거나, 복잡한 전략 구조를 새로 설계하지 않는다.

**스타일 & 톤**
- systemPrompt에 정의된 채널 페르소나, 톤앤매너, 금지 콘텐츠 유형을 반드시 따른다.
- 톤앤매너 예시(toneExample)가 있을 경우, 그 스타일을 자연스럽게 반영한다.

**내용**
- 글의 내용은 입력의 주제, 내용을 기반으로 작성한다.
- 실제 독자가 읽을 "완성된 포스트"라고 생각하고 자연스럽고 조건에 부합하는 글을 완성한다.

**출력 형식**
- 출력은 오직 최종 글만 포함하며, 마크다운 형식으로 작성한다.
- JSON, 설명 텍스트, 메타 정보, "분석/전략"에 대한 설명은 출력하지 않는다.
- 결과 맨 앞이나 맨 뒤에 "요약/설명/주의사항" 같은 메타 문장은 추가하지 않는다.

**글쓰기 스타일**
- 각 조건에 부합하게 최대한 '사람'이 쓴 것처럼 자연스럽게 글을 생성하라.

위 조건을 모두 만족하는, 깔끔하게 마무리된 최종 마케팅 포스트를 작성하라.

아래는 이번 글 생성에 사용될 모든 컨텍스트입니다.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\``;

    const responseText = await callOpenAIGPT5Generic(singleFlowPrompt);
    console.log('✅ 1회성 싱글 플로우 포스트 생성 완료');
    return responseText;

  } catch (error) {
    console.error('❌ 1회성 싱글 플로우 포스트 생성 실패:', error);
    throw error;
  }
}

/**
 * 채널 관련성 평가 함수
 */
export async function evaluateChannelRelevance(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig
): Promise<{ score: number; reason: string }> {
  const prompt = `아래 입력 데이터와 채널 정보를 분석하여, 이 채널에서 이 콘텐츠를 다루는 것이 얼마나 적절한지 0-100 점수로 평가하고 구체적인 이유를 설명하세요.

입력 데이터:
- 주제: ${inputConfig.topic}
- 내용: ${inputConfig.rawData.substring(0, 500)}...

채널 정보:
- 채널명: ${channelConfig.name}
- 채널 유형: ${channelConfig.channelType}
- 페르소나: ${channelConfig.personaTags.join(', ')}
- 관심사: ${channelConfig.highLevelContentTags.join(', ')}
- 채널 지식: ${channelConfig.channelKnowledge}

다음 형식으로 JSON 응답:
{
  "score": 0-100,
  "reason": "구체적인 평가 이유 (긍정적/부정적 요소 모두 포함)"
}`;

  try {
    const responseText = await callOpenAIGPT5Generic(prompt);
    const result = JSON.parse(responseText);
    return {
      score: result.score || 50,
      reason: result.reason || '평가 실패'
    };
  } catch (error) {
    console.error('채널 관련성 평가 실패:', error);
    return {
      score: 50,
      reason: '평가 중 오류 발생'
    };
  }
}

/**
 * 최적 포맷 선택 함수
 */
export async function selectBestFormat(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  availableFormats: ContentFormatNodeConfig[]
): Promise<{ bestFormat: ContentFormatNodeConfig; reason: string }> {
  const formatDescriptions = availableFormats.map(format => ({
    id: (format as any).id || 'unknown',
    name: format.name,
    type: format.mappedContentType,
    blockCount: format.formatBlocks.length,
    description: format.formatBlocks.map(block => block.title).join(', ')
  }));

  const prompt = `아래 입력 데이터, 채널 정보, 사용 가능한 포맷 목록을 분석하여 가장 적합한 포맷을 선택하고 구체적인 이유를 설명하세요.

입력 데이터:
- 주제: ${inputConfig.topic}
- 내용: ${inputConfig.rawData.substring(0, 300)}...

채널 정보:
- 채널명: ${channelConfig.name}
- 채널 유형: ${channelConfig.channelType}
- 페르소나: ${channelConfig.personaTags.join(', ')}

사용 가능한 포맷:
${formatDescriptions.map(f => `- ${f.name} (${f.type}): ${f.description}`).join('\n')}

다음 형식으로 JSON 응답:
{
  "selectedFormatId": "선택한 포맷 ID",
  "reason": "선택한 구체적인 이유"
}`;

  try {
    const responseText = await callOpenAIGPT5Generic(prompt);
    const result = JSON.parse(responseText);

    const bestFormat = availableFormats.find((f: any) => f.id === result.selectedFormatId) || availableFormats[0];

    return {
      bestFormat,
      reason: result.reason || '선택 실패'
    };
  } catch (error) {
    console.error('포맷 선택 실패:', error);
    return {
      bestFormat: availableFormats[0],
      reason: '선택 중 오류 발생'
    };
  }
}

/**
 * 포맷 제안 함수
 */
export async function suggestFormats(
  channelConfig: ChannelNodeConfig
): Promise<any[]> {
  console.log(`📝 포맷 제안 생성 시작: ${channelConfig.name} (${channelConfig.channelType})`);

  const prompt = `당신은 마케팅 콘텐츠 포맷 전문가입니다. 아래 채널 정보를 바탕으로 가장 적합한 콘텐츠 포맷 3개를 제안해주세요.

채널 정보:
- 채널명: ${channelConfig.name}
- 채널 유형: ${channelConfig.channelType}
- 페르소나: ${channelConfig.personaTags.join(', ')}
- 톤앤매너: ${channelConfig.toneTags.join(', ')}
- 주요 콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ')}
- 채널 설명: ${channelConfig.channelKnowledge || '없음'}

각 포맷은 다음 구조를 따라야 합니다:
- formatName: 포맷 이름 (예: "문제 해결형 가이드", "감성 브랜딩 스토리텔링")
- formatType: 포맷 유형 (예: "problem-solution", "brand-storytelling", "how-to-guide")
- overallStrategy: 전체 전략
  - funnelStage: 퍼널 단계 (awareness, consideration, conversion, retention)
  - emotionalArc: 감성적 흐름 (inspiration-relief-action, curiosity-trust-decision 등)
  - strategicFocus: 전략적 초점
  - recommendedLength: 추천 길이 ({minChars, maxChars})
- blocks: 포맷 블록 배열
  - name: 블록 이름
  - description: 블록 설명 (50자 이내)
  - recommendedLength: 추천 길이 (예: "300-500자")
  - coreStrategy: 핵심 전략 (블록의 역할과 목적)
  - keyMoves: 핵심 전략 배열 (구체적 실행 방법)
  - dos: 권장사항 배열
  - donts: 금지사항 배열

JSON 배열 형식으로 3개 포맷을 제안해주세요. 각 포맷은 채널 특성과 타겟에 맞게 차별화되어야 합니다.`;

  try {
    const responseText = await callOpenAIGPT5Generic(prompt);
    console.log('✅ 포맷 제안 생성 완료');

    try {
      const formats = JSON.parse(responseText);
      return Array.isArray(formats) ? formats : [formats];
    } catch (parseError) {
      console.error('⚠️ 포맷 제안 JSON 파싱 실패:', parseError);
      throw new Error('포맷 제안 파싱 실패');
    }
  } catch (error) {
    console.error('❌ 포맷 제안 생성 실패:', error);
    throw error;
  }
}

/**
 * 경로 관련성 평가 함수
 */
export async function evaluatePathRelevance(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<{ score: number; reason: string; shouldExecute: boolean }> {
  const prompt = `아래 정보를 분석하여 이 입력-채널-포맷 조합으로 콘텐츠를 생성하는 것이 얼마나 적절한지 평가하세요.

입력 데이터:
- 주제: ${inputConfig.topic}
- 내용 요약: ${inputConfig.rawData.substring(0, 200)}...

채널 정보:
- 채널: ${channelConfig.name} (${channelConfig.channelType})
- 페르소나: ${channelConfig.personaTags.join(', ')}

포맷 정보:
- 포맷: ${formatConfig.name} (${formatConfig.mappedContentType})
- 블록 수: ${formatConfig.formatBlocks.length}

평가 기준:
1. 주제와 채널의 적합성
2. 채널 페르소나와 포맷의 궁합
3. 내용의 포맷 적용 가능성
4. 기대 효과와 목적 달성 가능성

다음 형식으로 JSON 응답:
{
  "score": 0-100,
  "reason": "구체적인 평가 이유 (긍정/부정 요소 포함)",
  "shouldExecute": true/false
}`;

  try {
    const responseText = await callOpenAIGPT5Generic(prompt);
    const result = JSON.parse(responseText);
    return {
      score: result.score || 50,
      reason: result.reason || '평가 실패',
      shouldExecute: result.shouldExecute !== false
    };
  } catch (error) {
    console.error('경로 관련성 평가 실패:', error);
    return {
      score: 50,
      reason: '평가 중 오류 발생',
      shouldExecute: true
    };
  }
}

/**
 * OpenAI DALL-E 이미지 API 호출 함수
 */
async function callOpenAIImageAPI(prompt: string): Promise<string> {
  console.log('[Image] OpenAI DALL-E 이미지 생성 API 호출...');

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 환경 변수가 필요합니다.');
  }

  const requestBody = JSON.stringify({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    response_format: "b64_json"
  });

  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/images/generations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  return new Promise((resolve, reject) => {
    const req = require('https').request(options, (res: any) => {
      let data = '';

      res.on('data', (chunk: any) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode !== 200) {
            throw new Error(`OpenAI DALL-E API 오류: ${res.statusCode} - ${data}`);
          }

          if (!response.data || !response.data[0] || !response.data[0].b64_json) {
            throw new Error('OpenAI DALL-E API 응답 형식 오류');
          }

          console.log('[Image] 이미지 생성 성공');
          resolve(response.data[0].b64_json);
        } catch (error) {
          console.error('[Image] 응답 처리 실패:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error: any) => {
      console.error('[Image] 요청 실패:', error);
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * 이미지 생성 함수
 */
export async function generateImage(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  _formatConfig: ContentFormatNodeConfig
): Promise<string> {
  console.log('🎨 이미지 생성 시작...');

  const promptGenerationPrompt = `아래 정보를 바탕으로 마케팅용 이미지 생성 프롬프트를 만들어주세요.

주제: ${inputConfig.topic}
채널: ${channelConfig.name} (${channelConfig.channelType})
페르소나: ${channelConfig.personaTags.join(', ')}
톤앤매너: ${channelConfig.toneTags.join(', ')}
콘텐츠: ${inputConfig.rawData}

요구사항:
1. 채널 특성과 페르소나에 맞는 스타일
2. 마케팅 목적에 부합하는 구성
3. 주제를 시각적으로 명확히 전달
4. 전문적이고 고품질의 이미지
5. 텍스트 없이 시각적 요소만으로 의미 전달

프롬프트만 출력해주세요. 다른 설명은 필요 없습니다.`;

  try {
    const imagePrompt = await callOpenAIGPT5Generic(promptGenerationPrompt);
    console.log('📝 이미지 프롬프트 생성 완료:', imagePrompt.substring(0, 100));

    const imageData = await callOpenAIImageAPI(imagePrompt);
    console.log('✅ 이미지 생성 완료');

    return imageData;
  } catch (error) {
    console.error('❌ 이미지 생성 실패:', error);
    throw error;
  }
}

/**
 * Gamma API 호출 함수
 */
async function callGammaGenerateAPI(gammaApiKey: string, prompt: string, requestConfig: any): Promise<any> {
  console.log('[Gamma] Gamma API 호출 시작...');

  const requestBody = JSON.stringify({
    prompt: prompt,
    requestConfig: requestConfig
  });

  const options = {
    hostname: 'api.gamma.app',
    port: 443,
    path: '/v2/generate',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${gammaApiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  return new Promise((resolve, reject) => {
    const req = require('https').request(options, (res: any) => {
      let data = '';

      res.on('data', (chunk: any) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('[Gamma] API 응답 상태:', res.statusCode);

          if (res.statusCode !== 200) {
            throw new Error(`Gamma API 오류: ${res.statusCode} - ${data}`);
          }

          if (response.error) {
            throw new Error(`Gamma API 에러: ${response.error.message || response.error}`);
          }

          console.log('[Gamma] API 호출 성공');
          resolve(response);
        } catch (error) {
          console.error('[Gamma] 응답 처리 실패:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error: any) => {
      console.error('[Gamma] 요청 실패:', error);
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Gamma 소셜 포스트 생성 함수
 */
export async function generateGammaSocialPost(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<string> {
  console.log('📱 Gamma 소셜 포스트 생성 시작...');

  if (!GAMMA_API_KEY) {
    throw new Error('GAMMA_API_KEY 환경 변수가 필요합니다.');
  }

  const promptGenerationPrompt = `아래 정보를 바탕으로 Gamma 소셜 포스트 생성을 위한 프롬프트를 만들어주세요.

주제: ${inputConfig.topic}
채널: ${channelConfig.name} (${channelConfig.channelType})
페르소나: ${channelConfig.personaTags.join(', ')}
톤앤매너: ${channelConfig.toneTags.join(', ')}
콘텐츠: ${inputConfig.rawData}

요구사항:
1. 채널 특성과 페르소나에 맞는 톤앤매너
2. 마케팅 목적에 부합하는 설득력 있는 내용
3. 소셜 미디어 플랫폼에 적합한 길이와 구조
4. 참여 유도를 위한 콜투액션 포함
5. 전문적이면서도 친근한 표현

프롬프트만 출력해주세요. 다른 설명은 필요 없습니다.`;

  try {
    const gammaPrompt = await callOpenAIGPT5Generic(promptGenerationPrompt);
    console.log('📝 Gamma 프롬프트 생성 완료');

    const requestConfig = {
      tone: formatConfig.gammaTone || 'professional',
      audience: formatConfig.gammaAudience || 'general',
      detailLevel: formatConfig.gammaDetailLevel || 'medium',
      numCards: formatConfig.gammaNumCards || 1,
      imageSources: formatConfig.gammaImageSources || ['aiGenerated'],
      additionalInstructions: formatConfig.gammaAdditionalInstructions || ''
    };

    const response = await callGammaGenerateAPI(GAMMA_API_KEY, gammaPrompt, requestConfig);
    console.log('✅ Gamma 소셜 포스트 생성 완료');

    return response.url || response.generatedUrl || '';
  } catch (error) {
    console.error('❌ Gamma 소셜 포스트 생성 실패:', error);
    throw error;
  }
}