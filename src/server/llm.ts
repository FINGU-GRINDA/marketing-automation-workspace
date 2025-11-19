import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  InputNodeConfig,
  ChannelNodeConfig,
  ContentFormatNodeConfig,
} from './types.js';

// 환경 변수에서 API 키 가져오기 (없으면 mock 모드)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// API 키 설정 확인
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
  throw new Error('OPENAI_API_KEY 환경 변수가 필요합니다.');
}
const USE_MOCK = !GEMINI_API_KEY;

// Gemini 클라이언트 초기화
const genAI = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : null;

/**
 * 생성 컨텍스트 구성 함수
 */
function buildGenerationContext(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): object {
  const generationContext = {
    inputData: {
      topic: inputConfig.topic,
      rawData: inputConfig.rawData,
      title: inputConfig.title || inputConfig.topic,
      message: inputConfig.message || '',
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
  const systemPrompt = buildSystemPrompt(channelConfig);

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

규칙:

- messages에 들어가는 내용은 inputData와 channel.channelKnowledge에서만 가져온다.
- 새로운 숫자, 사례, 이름을 추가로 만들지 말고, 필요한 경우 "구체적인 예시"처럼 추상화해서 적어라.
- riskNotes에는 prohibitedTypes와 donts에서 유추되는 리스크 포인트를 명시하라.
- plannedLengthChars는 recommendedLength를 문자 수로 대략 환산하라 (예: "3~5문장" → 150자)`;

  try {
    console.log('🚀 [2단계 포스트 생성] 시작...');
    const planResponse = await callPostLLMGPT51(planningPrompt);

    // JSON 파싱
    const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('플랜 생성 응답에서 JSON을 찾을 수 없습니다.');
    }

    const plan = JSON.parse(jsonMatch[0]);

    // 결과 검증
    if (!plan.overallPlan || !plan.blocks || !Array.isArray(plan.blocks)) {
      throw new Error('플랜 생성 결과 형식이 올바르지 않습니다.');
    }

    // 디버깅 로그
    console.log('[POST PLAN]', JSON.stringify(plan, null, 2));
    console.log(`✅ [1단계] 전략 플랜 생성 완료: ${plan.blocks.length}개 블록 계획`);

    return plan;

  } catch (error) {
    console.error('🔥 포스트 플랜 생성 오류:', error);
    throw error;
  }
}

/**
 * 2단계: 최종 초안 생성
 * 1단계 플랜을 바탕으로 실제 포스트 작성
 */
async function generatePostFromPlan(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig,
  postPlan: any
): Promise<string> {
  console.log('✍️ [2단계] 최종 초안 생성 시작...');

  const generationContext = buildGenerationContext(inputConfig, channelConfig, formatConfig);
  const finalDraft = await generateFinalDraftFromPlan(generationContext, postPlan, inputConfig.targetLanguage || 'ko');

  return finalDraft;
}

/**
 * 🔹요청 3: 2단계 – 전략 플랜 기반 최종 초안 생성 + Hallucination 가드
 * 3-2. 2단계 LLM 프롬프트 구현
 */
async function generateFinalDraftFromPlan(
  generationContext: any,
  postPlan: any,
  targetLanguage: string = 'ko'
): Promise<string> {
  console.log('[STEP 2] Generating final draft based on plan...');

  const systemPrompt = buildSystemPrompt(generationContext.channel);

  const finalPrompt = `${systemPrompt}

아래는 글 생성에 사용할 컨텍스트와 1단계에서 만들어진 전략 플랜이다.

[CONTEXT JSON]
\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

[POST PLAN]
\`\`\`json
${JSON.stringify(postPlan, null, 2)}
\`\`\`

위 정보를 바탕으로, 최종 포스트 텍스트를 ${targetLanguage}로 작성하라.

필수 규칙:

**사실 정보**
구체적인 사실, 숫자, 사례, 브랜드 정보는 오직
generationContext.inputData와 generationContext.channel.channelKnowledge 안에 있는 것만 사용하라.

여기에 없는 구체적 정보는 만들어내지 말고,
"구체적인 수치", "특정 사례" 등으로 일반화해서 표현하라.

**구조**
postPlan.blocks 순서대로 글을 전개한다.

각 블록은 하나 이상의 문단으로 구성하되,
plannedLengthChars를 대략적으로 만족하도록 길이를 조절한다.

전체 글 길이는 overallPlan.targetLengthChars 범위 안에 두려고 노력한다.

**전략 반영**
각 블록의 role, messages, toneHints를 충실히 반영한다.

contentFormat.formatBlocks[i].keyMoves, dos, donts도 참고하여 표현 방식을 선택한다.

**톤앤매너**
channel.personaTags, toneTags, toneMannerExample을 참고해
채널에 자연스러운 말투로 작성한다.

toneMannerExample과 formatExampleText의 문장을 그대로 복사하지 말고,
분위기와 리듬만 참고해서 새 문장을 만들어라.

**금지 조건**
forbidden.prohibitedTypes와 각 블록의 donts, postPlan.blocks[*].riskNotes에 해당하는 표현은 절대 사용하지 말라.

출력 형식:
마크다운이나 JSON이 아니라, 최종 완성된 텍스트 본문만 출력한다.`;

  try {
    console.log('✍️ 최종 초안 생성 중...');
    const finalResult = await callPostLLMGPT51(finalPrompt);

    console.log(`✅ [2단계] 최종 초안 생성 완료: ${finalResult.length}자`);

    // 3-3. 간단한 서버 측 가드 구현
    const guardResult = performServerSideGuard(finalResult, generationContext);

    if (!guardResult.isValid) {
      console.warn('⚠️ 서버 측 가드 경고:', guardResult.warnings);
    }

    return finalResult;

  } catch (error) {
    console.error('🔥 최종 초안 생성 오류:', error);
    throw error;
  }
}

/**
 * 🔹요청 3: 3-3. 간단한 서버 측 가드 구현
 * 결과 텍스트 길이와 금지된 콘텐츠 포함 여부 검증
 */
function performServerSideGuard(
  resultText: string,
  generationContext: any
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  try {
    console.log('🔍 서버 측 가드 검증 시작...');

    // 1. 결과 텍스트 길이 검증
    const minLength = generationContext.contentFormat.overallStrategy?.recommendedLength?.minChars || 0;
    const textLength = resultText.trim().length;

    if (minLength > 0 && textLength < minLength * 0.7) {
      warnings.push(`결과 텍스트가 너무 짧습니다: ${textLength}자 (권장 최소: ${minLength}자의 70%)`);
    }

    // 2. prohibitedTypes 문자열 포함 검증
    const prohibitedTypes = generationContext.forbidden?.prohibitedTypes || [];

    for (const prohibitedType of prohibitedTypes) {
      if (resultText.includes(prohibitedType)) {
        warnings.push(`금지된 콘텐츠 유형 포함 감지: "${prohibitedType}"`);
      }
    }

    // 3. 기본 hallucination 체크
    // inputData에 없는 구체적인 브랜드명, 숫자 등이 포함되어 있는지 간단히 체크
    const inputDataText = generationContext.inputData?.rawData || '';
    const channelKnowledgeText = generationContext.channel?.channelKnowledge || '';
    const allowedText = (inputDataText + ' ' + channelKnowledgeText).toLowerCase();

    // 구체적인 숫자 패턴 체크 (년도, 가격, 퍼센트 등)
    const specificNumberPattern = /\b\d{4}년\b|\b\d+%\b|\b\d+,?\d*원\b|\b\d+만명\b/g;
    const foundNumbers = resultText.match(specificNumberPattern) || [];

    for (const number of foundNumbers) {
      if (!allowedText.includes(number.toLowerCase())) {
        warnings.push(`inputData에 없는 구체적인 수치 감지: "${number}"`);
        break; // 너무 많은 경고를 피하기 위해 하나만 기록
      }
    }

    // 4. 비정상적으로 긴 문장 체크 (hallucination 가능성)
    const sentences = resultText.split(/[.!?]+/);
    const overlyLongSentences = sentences.filter(sentence => sentence.trim().length > 200);

    if (overlyLongSentences.length > 0) {
      warnings.push(`비정상적으로 긴 문장 감지: ${overlyLongSentences.length}개 (hallucination 가능성)`);
    }

    const isValid = warnings.length === 0;

    if (!isValid) {
      console.log('🚨 가드 검증 결과 경고:');
      warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    } else {
      console.log('✅ 서버 측 가드 검증 통과');
    }

    return { isValid, warnings };

  } catch (error) {
    console.error('서버 측 가드 검증 중 오류:', error);
    return {
      isValid: false,
      warnings: ['가드 검증 중 오류 발생']
    };
  }
}

/**
 * 시스템 프롬프트 생성 함수
 */
function buildSystemPrompt(channelConfig: ChannelNodeConfig): string {
  return `너는 ${channelConfig.channelType} 채널에 포스트를 작성하는 시니어 마케터다.

너에게 제공되는 JSON 컨텍스트는 다음 세 가지로 나뉜다.
1) inputData: 이번 글에서 반드시 다루어야 할 구체적인 정보와 사실
2) contentFormat: 이 글이 따라야 할 콘텐츠 전략과 블록 구조
3) channel: 채널/브랜드의 페르소나, 톤앤매너, 지식, 금지되는 콘텐츠 유형

네가 작성하는 모든 문장은 다음 원칙을 따라야 한다.

[사실 사용 원칙]
- "사실 정보"로 말해도 되는 내용은
  inputData와 channel.channelKnowledge 안에 명시적으로 주어진 정보만이다.
- 이 외의 정보는 "전략, 톤, 구성, 표현 방식"을 정하는 데만 사용하고,
  새로운 숫자, 날짜, 사례, 브랜드명, 성과 지표 등을 만들어내지 마라.
- inputData와 channel.channelKnowledge에 없는 구체적인 수치나 사례는
  "구체적인 수치", "특정 사례" 등으로 일반화해서 표현하라.

[전략/구조 원칙]
- 글의 전체 길이는 contentFormat.overallStrategy.recommendedLength 범위 안에서 작성한다.
- 단락/문단 구성은 contentFormat.formatBlocks의 순서와 역할을 따른다.
- 각 블록의 coreStrategy, keyMoves, dos, donts를 최대한 반영해서 쓴다.

[톤앤매너 원칙]
- channel.personaTags, toneTags, toneMannerExample을 바탕으로
  채널에 자연스럽게 어울리는 말투로 작성한다.
- toneMannerExample의 문장을 복사하지 말고,
  분위기와 리듬만 참고해서 새 문장을 만들어라.

[금지 조건]
- forbidden.prohibitedTypes와 explicitBans에 포함된 주제, 표현 방식은 절대 사용하지 마라.

이 프롬프트에서는 아직 최종 글을 작성하지 않는다.
이 system prompt는 이후 단계별 프롬프트에서 재사용한다.`;
}

/**
 * 프롬프트 빌드 함수 (콘텐츠 유형별 분기)
 */
export function buildPrompt(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): string {
  const contentType = formatConfig.mappedContentType;

  // 컨텍스트 JSON 생성
  const generationContext = buildGenerationContext(inputConfig, channelConfig, formatConfig);
  const systemPrompt = buildSystemPrompt(channelConfig);

  // 콘텐츠 유형별 프롬프트
  switch (contentType) {
    case '포스트': {
      return `${systemPrompt}

다음 컨텍스트를 참고하여 포스트를 작성할 준비를 해라.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

이 컨텍스트를 바탕으로 각 블럭의 순서대로 내용을 구성하고, 자연스럽게 연결하여 완성된 글을 작성할 계획을 세워라.
아직 최종 글을 작성하지 말고, 어떤 내용을 어떤 순서로 다룰 것인지 구조적으로 설명해라.

결과를 다음 형식으로 출력:
---
**작성 계획:**
1. [첫 번째 블록 계획]
2. [두 번째 블록 계획]
...

**주요 전략 요소:**
- [전체 길이]: [예상 글자 수]
- [핵심 메시지]: [중심 전달 내용]
- [톤앤매너]: [적용할 말투 스타일]
---`;
    }

    case '일반이미지': {
      const imageSystemPrompt = `너는 ${channelConfig.channelType} 채널의 이미지를 기획하는 크리에이티브 디렉터다.

너에게 제공되는 JSON 컨텍스트를 바탕으로 이미지 생성 프롬프트를 작성해라.

[사실 사용 원칙]
- inputData의 내용을 바탕으로 이미지 컨셉을 구성한다.
- channel의 톤앤매너와 페르소나에 맞는 시각적 스타일을 적용한다.
- forbidden 조건을 반드시 준수한다.`;

      return `${imageSystemPrompt}

다음 컨텍스트를 참고하여 이미지 생성 프롬프트를 작성해라.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

결과는 다음 형식으로 출력:
---
**이미지 컨셉:**
[한 줄 컨셉 설명]

**비주얼 요소:**
- [구체적인 요소 1]
- [구체적인 요소 2]
- [구체적인 요소 3]

**이미지 생성 프롬프트:**
[AI 이미지 생성기에 입력할 수 있는 상세한 영문 프롬프트]
---`;
    }

    case '텍스트형 이미지': {
      const textImageSystemPrompt = `너는 ${channelConfig.channelType} 채널의 텍스트형 이미지를 기획하는 디자이너다.

너에게 제공되는 JSON 컨텍스트를 바탕으로 텍스트형 이미지 콘텐츠를 작성해라.

[사실 사용 원칙]
- inputData의 핵심 메시지를 중심으로 텍스트를 구성한다.
- channel의 톤앤매너를 반영한 문체를 사용한다.
- forbidden 조건을 반드시 준수한다.`;

      return `${textImageSystemPrompt}

다음 컨텍스트를 참고하여 텍스트형 이미지 콘텐츠를 작성해라.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

결과는 다음 형식으로 출력:
---
**메인 텍스트:**
[이미지에 들어갈 핵심 메시지]

**서브 텍스트:**
[보조 메시지 또는 설명]

**디자인 지시사항:**
- 배경: [색상, 스타일]
- 폰트: [크기, 굵기, 색상]
- 레이아웃: [배치 방식]

**이미지 생성 프롬프트:**
[텍스트 오버레이가 포함된 이미지 생성 프롬프트 (영문)]
---`;
    }

    case '보고서': {
      const reportSystemPrompt = `너는 ${channelConfig.channelType} 채널을 위한 보고서를 작성하는 애널리스트다.

너에게 제공되는 JSON 컨텍스트를 바탕으로 보고서를 작성해라.

[사실 사용 원칙]
- "사실 정보"로 말해도 되는 내용은 inputData와 channel.channelKnowledge 안에 명시적으로 주어진 정보만이다.
- 새로운 숫자, 날짜, 사례, 브랜드명, 성과 지표 등을 만들어내지 마라.
- inputData와 channel.channelKnowledge에 없는 구체적인 수치나 사례는 "구체적인 수치", "특정 사례" 등으로 일반화해서 표현하라.

[전문성 원칙]
- 전문적이고 객관적인 어조를 유지한다.
- 채널의 페르소나와 톤에 맞는 전문적인 표현을 사용한다.`;

      return `${reportSystemPrompt}

다음 컨텍스트를 참고하여 보고서를 작성해라.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

보고서 형식으로 섹션을 명확히 구분하여 출력해라.`;
    }

    default:
      // 기본 프롬프트
      return `${systemPrompt}

다음 컨텍스트를 참고하여 ${contentType} 유형의 콘텐츠를 작성해라.

\`\`\`json
${JSON.stringify(generationContext, null, 2)}
\`\`\`

결과를 하나의 완성된 텍스트로 출력해라.`;
  }
}

/**
 * Gemini API 호출 (실제) - 재시도 로직 및 모델 전환 전략 포함
 */
async function callGeminiAPI(prompt: string, maxRetries: number = 3): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  // 사용할 모델 우선순위 (할당량이 높은 순서대로)
  const modelPriority = [
    { name: 'gemini-1.5-pro', description: 'Gemini 1.5 Pro (중간 할당량)' },
    { name: 'gemini-2.5-pro', description: 'Gemini 2.5 Pro (낮은 할당량)' },
    { name: 'gemini-1.5-pro-latest', description: 'Gemini 1.5 Pro Latest (대체 모델)' }
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const modelConfig of modelPriority) {
      try {
        console.log(`🚀 ${modelConfig.description} API 호출 시도 ${attempt}/${maxRetries}...`);

        const model = genAI.getGenerativeModel({ model: modelConfig.name });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Empty response from Gemini API');
        }

        console.log(`✅ ${modelConfig.description} API 호출 성공 (시도 ${attempt})`);
      return text;

      } catch (error: any) {
        console.error(`❌ ${modelConfig.description} API 호출 실패 (시도 ${attempt}/${maxRetries}):`, error.message);

        // 할당량 초과 오류인 경우 다음 모델 시도
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Too Many Requests')) {
          console.log(`🔄 ${modelConfig.description} 할당량 초과. 다음 모델로 전환...`);
          break; // 현재 모델은 건너뛰고 다음 모델로
        }

        // 기타 오류는 다음 모델 시도
        console.log(`🔄 ${modelConfig.description}에서 다른 오류 발생. 다음 모델로 전환...`);
        break; // 현재 모델은 건너뛰고 다음 모델로
      }
    }

    // 모든 모델을 시도했는데 실패했다면
    if (attempt < maxRetries) {
      // 지수 백오프: 60초, 120초, 240초
      const waitTime = 60 * Math.pow(2, attempt - 1);
      console.log(`⏳ 모든 모델 실패로 ${waitTime}초 후 재시도합니다...`);

      // 대기
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      continue;
    }
  }

  throw new Error('Gemini API 호출 실패: 모든 모델에서 최대 재시도 횟수 초과');
}

/**
 * 텍스트 유사성 검증 - 10단어 이상 연속 중복 확인
 */
function validateTextSimilarity(text: string, referenceText: string): {
  isValid: boolean;
  violations: Array<{ start: number; end: number; text: string }>;
} {
  const violations: Array<{ start: number; end: number; text: string }> = [];
  const words = text.toLowerCase().split(/\s+/);
  const refWords = referenceText.toLowerCase().split(/\s+/);

  // 10단어 이상 연속으로 동일한 텍스트가 있는지 확인
  for (let i = 0; i <= words.length - 10; i++) {
    const sequence = words.slice(i, i + 10).join(' ');

    // 참조 텍스트에서 10단어 이상 연속 시퀀스 검색
    for (let j = 0; j <= refWords.length - 10; j++) {
      const refSequence = refWords.slice(j, j + 10).join(' ');

      if (sequence === refSequence) {
        const originalStart = words.slice(0, i).join(' ').length;
        const originalEnd = originalStart + sequence.length;
        violations.push({
          start: originalStart,
          end: originalEnd,
          text: text.substring(originalStart, originalEnd)
        });
        break;
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

/**
 * 민감한 정보 및 특정 개체 일반화
 */
function generalizeText(text: string): string {
  // 브랜드 이름, 특정 숫자, 날짜, 플랫폼 이름 등을 일반화
  let generalized = text;

  // 브랜드 이름 (일부 패턴)
  const brandPatterns = [
    /\b[Ss]amsung\b/g, /\b[Aa]pple\b/g, /\b[Gg]oogle\b/g,
    /\b[Nn]aver\b/g, /\b[Kk]akao\b/g, /\b[Cc]oupang\b/g,
    /\b[Aa]mazon\b/g, /\b[Mm]eta\b/g, /\b[Tt]esla\b/g
  ];

  // 숫자 패턴 (연도, 가격, 통계 등)
  const numberPatterns = [
    /\b\d{4}년\b/g, /\b\d{1,2}월\b/g, /\b\d{1,2}일\b/g,
    /\b\d+%\b/g, /\b\d+,?\d*원\b/g, /\b\d+만명\b/g,
    /\b\d+[.,]?\d*배\b/g
  ];

  // 플랫폼 이름
  const platformPatterns = [
    /\b[Ii]nstagram\b/g, /\b[Tt]witter\b/g, /\b[Ff]acebook\b/g,
    /\b[Ll]inkedin\b/g, /\b[Yy]outube\b/g, /\b[Tt]ik[Tt]ok\b/g
  ];

  // 대체
  brandPatterns.forEach(pattern => {
    generalized = generalized.replace(pattern, '브랜드');
  });

  numberPatterns.forEach(pattern => {
    generalized = generalized.replace(pattern, '특정 수치');
  });

  platformPatterns.forEach(pattern => {
    generalized = generalized.replace(pattern, '플랫폼');
  });

  // 이메일, 전화번호, URL 등 개인정보 패턴
  generalized = generalized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '이메일 주소');
  generalized = generalized.replace(/\b\d{3}-\d{3,4}-\d{4}\b/g, '전화번호');
  generalized = generalized.replace(/https?:\/\/[^\s]+/g, '웹사이트 주소');

  return generalized;
}

/**
 * Mock LLM 응답 생성
 */
function generateMockResponse(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): string {
  return `[MOCK 생성 콘텐츠]

채널: ${channelConfig.name} (${channelConfig.channelType})
콘텐츠 유형: ${formatConfig.mappedContentType}

주제: ${inputConfig.topic}

---

${formatConfig.formatStructureDescription}에 따라 생성된 콘텐츠입니다.

페르소나: ${channelConfig.personaTags.join(', ')}
톤앤매너: ${channelConfig.toneTags.join(', ')}

원본 데이터:
${inputConfig.rawData.substring(0, 200)}${inputConfig.rawData.length > 200 ? '...' : ''}

---

[실제 Gemini API를 사용하려면 .env 파일에 GEMINI_API_KEY를 설정하세요]

이 콘텐츠는 ${channelConfig.channelType} 채널에 최적화된 ${formatConfig.mappedContentType} 형식으로 작성되었습니다.`;
}

/**
 * 포스트 생성을 위한 GPT-5.1 전용 LLM 호출 함수
 */
async function callPostLLMGPT51(prompt: string): Promise<string> {
  try {
    console.log('📝 GPT-5.1로 포스트 생성 중...');
    return await callOpenAIGPT5Generic(prompt);
  } catch (error: any) {
    console.error('🔥 GPT-5.1 API 실패:', error.message);
    throw new Error(`GPT-5.1 LLM API 실패: ${error.message}`);
  }
}

/**
 * LLM 호출 메인 함수 (2단계 플로우 - Mock/Real 자동 선택)
 */
export async function callLLM(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<string> {
  const contentType = formatConfig.mappedContentType;

  // 포스트 유형만 2단계 플로우 적용
  if (contentType === '포스트') {
    if (USE_MOCK) {
      console.log('Using MOCK 2단계 플로우 (GEMINI_API_KEY not set)');
      // MOCK 모드에서는 간단한 플랜 반환
      const mockPlan = {
        overallPlan: {
          targetLengthChars: { min: 800, max: 1200 },
          mainAngle: "MOCK: 디지털 마케팅 전략 소개",
          keyMessages: ["MOCK: 핵심 메시지 1", "MOCK: 핵심 메시지 2"]
        },
        blocks: [
          {
            blockId: "mock-block-1",
            title: "소개",
            role: "관심 유발",
            plannedLengthChars: 300,
            messages: ["MOCK: 소개 메시지"],
            toneHints: ["친근한 말투"],
            riskNotes: ["MOCK: 과장된 표현 주의"]
          }
        ]
      };

      console.log('[MOCK PLAN]', JSON.stringify(mockPlan, null, 2));
      return "[MOCK] 2단계 플로우에 따른 생성된 포스트입니다.";
    }

    try {
      console.log('🚀 [2단계 포스트 생성] 시작...');

      // 1단계: 전략 플랜 생성
      const postPlan = await planPostFromContext(inputConfig, channelConfig, formatConfig);

      // 2단계: 최종 초안 생성
      const finalContent = await generatePostFromPlan(inputConfig, channelConfig, formatConfig, postPlan);

      return finalContent;

    } catch (error) {
      console.error('2단계 포스트 생성 실패, 기본 단일 플로우로 전환:', error);
      // 실패 시 기존 단일 호출 방식으로 fallback
      const prompt = buildPrompt(inputConfig, channelConfig, formatConfig);
      return await callPostLLMGPT51(prompt);
    }
  }

  // 포스트 외 다른 유형은 기존 방식 유지
  const prompt = buildPrompt(inputConfig, channelConfig, formatConfig);

  if (USE_MOCK) {
    console.log('Using MOCK LLM response (GEMINI_API_KEY not set)');
    return generateMockResponse(inputConfig, channelConfig, formatConfig);
  }

  console.log('Calling GPT-5 API (gpt-4)...');
  return await callOpenAIGPT5Generic(prompt);
}

/**
 * 채널 적합성 평가 프롬프트 빌드
 */
function buildChannelRelevancePrompt(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig
): string {
  return `당신은 콘텐츠 마케팅 전략가입니다. 주어진 입력 데이터가 특정 채널에 적합한지 판단해야 합니다.

[입력 데이터]
주제: ${inputConfig.topic}
원본 데이터:
${inputConfig.rawData}

[채널 정보]
채널 타입: ${channelConfig.channelType}
채널 이름: ${channelConfig.name}
페르소나 태그: ${channelConfig.personaTags.join(', ') || '없음'}
톤 태그: ${channelConfig.toneTags.join(', ') || '없음'}
콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ') || '없음'}
채널 지식/브랜드 설명: ${channelConfig.channelKnowledge || '없음'}
${channelConfig.prohibitedTypes && channelConfig.prohibitedTypes.length > 0 ? `금지된 콘텐츠 유형: ${channelConfig.prohibitedTypes.join(', ')}` : ''}

다음 기준으로 평가하세요:
1. 입력 데이터의 주제가 이 채널의 방향성/전문 분야와 맞는가?
2. 페르소나 태그와 입력 데이터의 대상이 일치하는가?
3. 채널의 브랜드 이미지/지식과 입력 내용이 조화로운가?
4. 금지된 유형에 해당하지 않는가?
5. 충분한 정보가 있어서 의미 있는 콘텐츠를 만들 수 있는가?

**중요**: 다음 경우에는 반드시 false를 반환하세요:
- 입력 데이터가 채널의 주제/방향성과 완전히 무관한 경우
- 입력 데이터가 금지된 콘텐츠 유형에 해당하는 경우
- 입력 데이터가 너무 부족하거나 빈 경우

응답 형식:
{
  "suitable": true/false,
  "confidence": 0-100,
  "reason": "판단 이유를 한 문장으로"
}

JSON만 반환하세요.`;
}

/**
 * 경로 적합성 평가 프롬프트 빌드 (Input + Channel + Format)
 */
function buildRelevancePrompt(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): string {
  return `당신은 콘텐츠 마케팅 전략가입니다. 주어진 입력 데이터가 특정 채널과 콘텐츠 포맷 조합(경로)에 적합한지 판단해야 합니다.

[입력 데이터]
주제: ${inputConfig.topic}
원본 데이터:
${inputConfig.rawData}

[채널 정보]
채널 타입: ${channelConfig.channelType}
채널 이름: ${channelConfig.name}
페르소나 태그: ${channelConfig.personaTags.join(', ') || '없음'}
톤 태그: ${channelConfig.toneTags.join(', ') || '없음'}
콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ') || '없음'}
채널 지식/브랜드 설명: ${channelConfig.channelKnowledge || '없음'}
${channelConfig.prohibitedTypes && channelConfig.prohibitedTypes.length > 0 ? `금지된 콘텐츠 유형: ${channelConfig.prohibitedTypes.join(', ')}` : ''}

[포맷 정보]
포맷 이름: ${formatConfig.name}
콘텐츠 유형: ${formatConfig.mappedContentType}
포맷 구조 설명: ${formatConfig.formatStructureDescription}
포맷 예시 텍스트: ${formatConfig.formatExampleText}

다음 기준으로 평가하세요:
1. 입력 데이터의 주제와 내용이 채널과 포맷의 목적/형식에 잘 맞는가?
2. 이 채널의 페르소나와 톤에 어울리는 주제/내용인가?
3. 이 포맷 구조로 내용을 구성했을 때 효과적으로 메시지를 전달할 수 있는가?
4. 채널에서 금지된 콘텐츠 유형에 해당하지 않는가?
5. 입력 데이터의 양과 질이 이 포맷으로 콘텐츠를 만들기에 충분한가?

**중요**: 다음 경우에는 반드시 false를 반환하세요:
- 입력 데이터가 채널/포맷의 주제/목적과 완전히 무관한 경우
- 입력 데이터가 금지된 콘텐츠 유형에 해당하는 경우
- 입력 데이터가 너무 부족하거나 빈 경우

응답 형식:
{
  "suitable": true/false,
  "confidence": 0-100,
  "reason": "판단 이유를 한 문장으로"
}

JSON만 반환하세요.`;
}

/**
 * 최적 포맷 선택 프롬프트 빌드
 */
function buildFormatSelectionPrompt(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfigs: Array<{ id: string; name: string; config: ContentFormatNodeConfig }>
): string {
  const formatDescriptions = formatConfigs
    .map((f, idx) => {
      return `${idx + 1}. "${f.name}"
   콘텐츠 유형: ${f.config.mappedContentType}
   구조: ${f.config.formatStructureDescription.substring(0, 150)}...`;
    })
    .join('\n\n');

  return `당신은 콘텐츠 마케팅 전문가입니다. 주어진 입력 데이터와 채널에 가장 적합한 콘텐츠 포맷 1개를 선택해야 합니다.

[입력 데이터]
주제: ${inputConfig.topic}
원본 데이터:
${inputConfig.rawData}

[채널 정보]
채널 이름: ${channelConfig.name} (${channelConfig.channelType})
페르소나: ${channelConfig.personaTags.join(', ') || '없음'}
톤: ${channelConfig.toneTags.join(', ') || '없음'}
콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ') || '없음'}

[사용 가능한 포맷들]
${formatDescriptions}

**선택 기준**:
1. 입력 데이터의 성격(정보성/스토리/분석 등)에 가장 잘 맞는 포맷
2. 채널의 콘텐츠 태그와 연관성이 높은 포맷
3. 입력 데이터를 가장 효과적으로 전달할 수 있는 구조

**중요**:
- 반드시 1개의 포맷만 선택하세요
- 포맷 이름을 정확히 반환하세요

응답 형식:
{
  "selectedFormat": "선택한 포맷의 정확한 이름",
  "confidence": 0-100,
  "reason": "선택 이유를 한 문장으로"
}

JSON만 반환하세요.`;
}

/**
 * 평가 결과 인터페이스
 */
export interface RelevanceEvaluation {
  suitable: boolean;
  confidence: number;
  reason: string;
}

export interface FormatSelection {
  selectedFormat: string;
  confidence: number;
  reason: string;
}

/**
 * 채널 적합성 평가 (AI 판단)
 */
export async function evaluateChannelRelevance(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig
): Promise<RelevanceEvaluation> {
  if (USE_MOCK) {
    return {
      suitable: true,
      confidence: 100,
      reason: 'MOCK 모드: 모든 채널 허용',
    };
  }

  try {
    const prompt = buildChannelRelevancePrompt(inputConfig, channelConfig);
    const responseText = await callOpenAIGPT5Generic(prompt);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Failed to parse channel evaluation, defaulting to suitable');
      return {
        suitable: true,
        confidence: 50,
        reason: 'JSON 파싱 실패, 기본값 사용',
      };
    }

    const evaluation = JSON.parse(jsonMatch[0]) as RelevanceEvaluation;

    if (typeof evaluation.suitable !== 'boolean') {
      evaluation.suitable = true;
    }
    if (typeof evaluation.confidence !== 'number') {
      evaluation.confidence = 50;
    }
    if (typeof evaluation.reason !== 'string') {
      evaluation.reason = '이유 없음';
    }

    return evaluation;
  } catch (error) {
    console.error('Error evaluating channel relevance:', error);
    return {
      suitable: true,
      confidence: 50,
      reason: '평가 오류, 기본 허용',
    };
  }
}

/**
 * 최적 포맷 선택 (AI 판단)
 */
export async function selectBestFormat(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfigs: Array<{ id: string; name: string; config: ContentFormatNodeConfig }>
): Promise<FormatSelection | null> {
  if (USE_MOCK) {
    // MOCK 모드에서는 첫 번째 포맷 선택
    if (formatConfigs.length > 0) {
      return {
        selectedFormat: formatConfigs[0].name,
        confidence: 100,
        reason: 'MOCK 모드: 첫 번째 포맷 선택',
      };
    }
    return null;
  }

  try {
    const prompt = buildFormatSelectionPrompt(inputConfig, channelConfig, formatConfigs);
    const responseText = await callOpenAIGPT5Generic(prompt);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Failed to parse format selection, using first format');
      if (formatConfigs.length > 0) {
        return {
          selectedFormat: formatConfigs[0].name,
          confidence: 50,
          reason: 'JSON 파싱 실패, 첫 번째 포맷 사용',
        };
      }
      return null;
    }

    const selection = JSON.parse(jsonMatch[0]) as FormatSelection;

    // 선택된 포맷이 실제로 존재하는지 확인
    const selectedExists = formatConfigs.some((f) => f.name === selection.selectedFormat);
    if (!selectedExists && formatConfigs.length > 0) {
      console.warn(`Selected format "${selection.selectedFormat}" not found, using first format`);
      return {
        selectedFormat: formatConfigs[0].name,
        confidence: 50,
        reason: '선택한 포맷 없음, 첫 번째 포맷 사용',
      };
    }

    return selection;
  } catch (error) {
    console.error('Error selecting best format:', error);
    if (formatConfigs.length > 0) {
      return {
        selectedFormat: formatConfigs[0].name,
        confidence: 50,
        reason: '선택 오류, 첫 번째 포맷 사용',
      };
    }
    return null;
  }
}

/**
 * 채널 기반 포맷 제안
 */
export interface FormatSuggestion {
  formatName: string;
  formatType: "포스트" | "일반이미지" | "소셜포스트" | "뉴스레터" | "기타";
  overallStrategy: {
    funnelStage: string;
    emotionalArc: string;
    strategicFocus: string;
    recommendedLength: {
      minChars: number;
      maxChars: number;
    };
  };
  blocks: Array<{
    name: string;
    recommendedLength: string;
    coreStrategy: string;
    keyMoves: string[];
    dos: string[];
    donts: string[];
  }>;
}

function buildFormatSuggestionPrompt(channelConfig: ChannelNodeConfig): string {
  return `[목적]

이 프롬프트의 목적은, 주어진 채널 정보를 분석하여
해당 채널에 적합한 일반화된 콘텐츠 포맷 2~3개를 설계하는 것이다.

각 포맷은:
- 이 채널의 페르소나, 톤앤매너, 콘텐츠 태그, 채널 설명을 반영하고
- 특정 주제나 사례에 종속되지 않는 "재사용 가능한 전략 포맷"이어야 하며
- 아래 JSON 스키마에 맞게 전략 요약(overallStrategy)과 전략적 블록 구조(blocks)를 포함해야 한다.

**중요: 채널 정보가 부족하더라도(예: 콘텐츠 태그나 채널 설명이 없더라도),
채널 타입과 페르소나/톤 정보만으로도 해당 채널의 일반적인 특성을 파악하여
적합한 포맷을 제안할 수 있다. 예를 들어, 'threads'는 짧은 소셜포스트에 적합하고,
'blog'는 긴 교육 콘텐츠에 적합한 식으로 채널 타입별 특성을 활용한다.**

[입력: 채널 정보]

- channelType: 채널 타입 (예: 블로그, 인스타그램, 링크드인, 뉴스레터 등)
- name: 채널 이름
- personaTags: 타깃 페르소나 태그 목록
- toneTags: 톤·스타일 태그 목록
- highLevelContentTags: 채널에서 다루는 주제/카테고리 태그 목록
- channelKnowledge: 채널/브랜드의 정체성, 포지셔닝, 역할 설명
- toneMannerExample: 실제 채널 말투/문체 예시
- prohibitedTypes: 피해야 할 콘텐츠 유형/주제 목록

[해야 할 작업]

1. 위 채널 정보를 바탕으로, 이 채널에서 반복적으로 활용할 수 있는
   "콘텐츠 포맷" 후보를 2~3개 선정한다.
   - 예: 교육형 뉴스레터 포맷, 짧은 스토리텔링 포스트, 인사이트 요약 포맷 등
   - 각 포맷은 서로 다른 목적/스타일/구조를 가져야 한다.

2. 각 포맷에 대해:
   - 이 포맷이 어떤 퍼널 단계(funnelStage)에 가장 적합한지 정한다.
     (인지 → 관심 → 고려 → 행동 중에서 선택하거나 조합)
   - 채널의 페르소나/톤/콘텐츠 태그를 기반으로
     독자가 어떤 감정 흐름(emotionalArc)을 경험하면 좋을지 설계한다.
   - 채널이 가진 역할/포지셔닝(channelKnowledge)을 고려해
     strategicFocus(전략적 집점)를 정의한다.
   - 이 채널에서 현실적으로 소화 가능한 글 길이를 고려해
     recommendedLength(minChars, maxChars)를 정한다.
     (예: 블로그는 800~1500자, 짧은 포스트는 300~600자 등)

3. 각 포맷의 blocks를 설계한다.
   - 블록은 이 포맷이 실제로 전개될 때의 단계(후킹, 문제 제시, 인사이트, 사례, CTA 등)를 의미한다.
   - 레퍼런스가 없더라도, 이 채널의 특성(페르소나, 톤, 콘텐츠 태그, channelKnowledge)을 기준으로
     가장 자연스럽고 반복 사용 가능한 구조로 블록을 나눈다.
   - 블록 개수는 포맷당 3~7개 정도가 적당하며, 최대 10개를 넘지 않는다.

[전략 요약(overallStrategy) 작성 지침]

각 포맷의 overallStrategy는 다음 네 가지를 반드시 포함해야 한다.

1. funnelStage
   - 이 포맷이 겨냥하는 퍼널 단계.
   - 예: "인지", "관심", "관심→고려", "고려→행동" 등
   - 채널 타입과 페르소나를 고려해 가장 자연스러운 단계를 선택한다.
     - 예: 블로그/뉴스레터 → "관심/고려" 중심
     - 숏폼/피드형 채널 → "인지/관심" 중심 등

2. emotionalArc
   - 독자가 이 포맷을 읽는 동안 겪게 될 감정 흐름을 서술한다.
   - 예:
     - "호기심 → 공감 → 안도감 → 행동 의지"
     - "문제 인식 → 긴장감 → 통찰 → 동기부여"
   - toneTags와 toneMannerExample을 참고하여 이 채널에 자연스러운 감정 흐름을 설계한다.

3. strategicFocus
   - 이 포맷이 반복적으로 수행하는 전략적 기능을 한 문장으로 정리한다.
   - 예:
     - "실용적인 팁을 통해 전문가 신뢰도 구축"
     - "현실적인 실패 사례 공유로 공감과 회복 탄력성 강조"
     - "데이터를 기반으로 의사결정에 도움을 주는 인사이트 제공"
   - channelKnowledge와 highLevelContentTags를 기반으로 정의한다.

4. recommendedLength
   - 이 채널 특성과 페르소나의 소비 패턴을 고려해
     가장 적절한 글 길이 범위를 문자 수 기준으로 제안한다.
   - 예:
     - 블로그형: 800~1500자
     - 짧은 소셜 포스트: 300~600자
     - 뉴스레터 서론 섹션: 400~800자 등

[전략적 블록 구조(blocks) 작성 지침]

각 포맷의 blocks 배열에서, 각 블록은 다음 필드를 가진다.

- name:
  - 블록 제목. 예: "후킹", "문제 인식", "핵심 인사이트", "사례 소개", "실행 제안" 등
  - 채널 톤과 페르소나에 자연스럽게 맞는 이름을 사용한다.

- recommendedLength:
  - 이 블록이 실제 글에서 차지해야 할 구체적인 길이.
  - 예: "2~3문장, 약 150자", "짧은 한 단락(3~4문장)", "2단락, 합계 300~400자" 등.
  - 전체 recommendedLength와의 균형을 고려해 결정한다.

- coreStrategy:
  - 이 블록이 수행하는 핵심 전략 역할을 한 문장으로 정리한다.
  - 예:
    - "독자의 현재 고민을 구체적으로 떠올리게 하여 공감 유도"
    - "채널이 가진 전문성을 드러내는 핵심 인사이트 제시"
    - "행동 부담을 낮추는 부드러운 CTA로 마무리" 등.

- keyMoves:
  - 이 블록에서 반복적으로 사용할 수 있는 전개/표현 기법을 3~5개 나열한다.
  - 예:
    - "질문으로 문단 시작"
    - "숫자 한 개로 긴장감 형성"
    - "짧은 사례 먼저 보여주고 원칙 정리"
    - "페르소나가 자주 겪는 상황을 대화체로 묘사" 등.

- dos:
  - 이 블록을 쓸 때 반드시 지키면 좋은 실행 가이드 3~5개.
  - 채널의 toneTags, toneMannerExample을 반영해
    "이 채널다운" 표현 방식과 태도를 정리한다.

- donts:
  - 이 블록에서 피해야 할 표현/전개 방식 3~5개.
  - prohibitedTypes와 채널 이미지에 어울리지 않는 표현을 중심으로 정리한다.
  - 예: "과장된 수치 약속 금지", "선정적인 표현 사용 금지", "타인을 조롱하는 농담 금지" 등.

[제약 사항]

- 특정 회사명, 사람 이름, 서비스명, 숫자, 날짜, 지명 등
  구체적인 고유명사를 사용하지 않는다.
- toneMannerExample의 문장을 그대로 복사하지 말고,
  말투·리듬·분위기만 참고해서 전략 설명을 작성한다.
- 주제/사례/키워드 수준의 구체적인 컨텐츠 내용은 만들지 말고,
  포맷이 어떻게 말을 거는지(전략, 구조, 톤)에만 집중한다.
- blocks 개수는 포맷당 최대 10개,
  keyMoves는 블록당 최대 8개,
  dos/donts는 블록당 각각 최대 6개까지 생성한다.
- funnelStage, emotionalArc, strategicFocus, blocks의 모든 필드값은
  targetLanguage로 작성한다.

[출력 형식]

- 응답은 **JSON 배열**이어야 하며,
  2~3개의 포맷 객체를 포함한다.
- 배열 안 각 원소는 아래 스키마를 따라야 한다.
- JSON 바깥에 자연어 설명, 주석, 마크다운을 추가하지 않는다.

[
  {
    "formatName": string,
    "formatType": "포스트" | "일반이미지" | "소셜포스트" | "뉴스레터" | "기타",
    "overallStrategy": {
      "funnelStage": "string (인지/관심/고려/행동 단계 중 선택 또는 조합)",
      "emotionalArc": "string (구체적인 감정적 변화 과정)",
      "strategicFocus": "string (주요 전략적 집점)",
      "recommendedLength": {
        "minChars": number,
        "maxChars": number
      }
    },
    "blocks": [
      {
        "name": "string",
        "recommendedLength": "string (구체적인 권장 길이)",
        "coreStrategy": "string (해당 블록의 핵심 전략)",
        "keyMoves": ["string (구체적인 전개/표현 기법)"],
        "dos": ["string (반드시 해야 할 긍정적 행동 지침)"],
        "donts": ["string (반드시 피해야 할 부정적 행동 지침)"]
      }
    ]
  }
]

[채널 정보]
채널 타입: ${channelConfig.channelType}
채널 이름: ${channelConfig.name}
페르소나 태그: ${channelConfig.personaTags.join(', ') || '없음'}
톤 태그: ${channelConfig.toneTags.join(', ') || '없음'}
콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ') || '없음'}
채널 지식/브랜드 설명: ${channelConfig.channelKnowledge || '없음'}
톤앤매너 예시: ${channelConfig.toneMannerExample || '없음'}
금지 타입: ${channelConfig.prohibitedTypes?.join(', ') || '없음'}

**참고: 위 정보 중 일부가 '없음'으로 표시되더라도,
채널 타입(${channelConfig.channelType})의 일반적인 특성과
페르소나/톤 정보를 바탕으로 적합한 포맷을 제안하세요.
예를 들어:
- threads/instagram/x: 짧은 소셜포스트 (200-600자)
- blog: 긴 교육/정보 콘텐츠 (800-2000자)
- linkedin: 전문적인 비즈니스 콘텐츠 (400-1000자)
- youtube: 스크립트 기반 비디오 콘텐츠 (600-1500자)
- newsletter: 정기적인 소식/정보 제공 (300-800자)**

타겟 언어: ko`;
}

export async function suggestFormats(
  channelConfig: ChannelNodeConfig
): Promise<FormatSuggestion[]> {
  console.log('=== AI 포맷 제안 시작 ===');
  console.log('채널:', channelConfig.name);
  console.log('채널 타입:', channelConfig.channelType);
  console.log('페르소나 태그:', channelConfig.personaTags);
  console.log('톤 태그:', channelConfig.toneTags);
  console.log('콘텐츠 태그:', channelConfig.highLevelContentTags);

  if (USE_MOCK) {
    console.log('MOCK 모드: 샘플 포맷 반환');
    // Mock 모드에서는 채널 정보를 기반으로 3개의 샘플 포맷 반환
    const toneText = channelConfig.toneTags.length > 0
      ? channelConfig.toneTags.join(', ')
      : '친근하고 전문적인';

    const personaText = channelConfig.personaTags.length > 0
      ? channelConfig.personaTags.join(', ')
      : '일반 독자';

    // 채널 타입에 따른 포맷 타입 결정
    const getFormatType = () => {
      switch (channelConfig.channelType) {
        case 'blog': return '뉴스레터';
        case 'instagram':
        case 'threads':
        case 'x': return '소셜포스트';
        case 'youtube': return '포스트';
        default: return '소셜포스트';
      }
    };

    return [
      {
        formatName: '스토리텔링 감성형 포맷',
        formatType: getFormatType(),
        overallStrategy: {
          funnelStage: '관심→고려',
          emotionalArc: '호기심 → 공감 → 감동 → 행동 의지',
          strategicFocus: '현실적인 경험 공유를 통한 정서적 연결 강화',
          recommendedLength: {
            minChars: 400,
            maxChars: 800
          }
        },
        blocks: [
          {
            name: '후킹/상황 제시',
            recommendedLength: '2~3문장, 약 100자',
            coreStrategy: '독자의 일상적인 상황을 제시하여 공감 유도',
            keyMoves: ['질문으로 시작', '구체적인 상황 묘사', '공감 가능한 감정 언급'],
            dos: ['익숙한 일상 장면 제시', '부드러운 호칭 사용', '긍정적 분위기 조성'],
            donts: ['과장된 상황 설정', '부정적 사건 묘사', '어려운 전문어 사용']
          },
          {
            name: '스토리 전개',
            recommendedLength: '4~6문장, 약 300자',
            coreStrategy: '인물의 변화 과정을 통해 감정 이입 유도',
            keyMoves: ['시간의 흐름 따라 전개', '대화체 삽입', '감정 변화 묘사'],
            dos: ['자연스러운 대화 포함', '감정선 명확히 표현', '긴장감과 해소 구조'],
            donts: ['복잡한 인물 관계 설정', '불필요한 배경 설명', '인위적인 감정선 강조']
          },
          {
            name: '메시지 정리',
            recommendedLength: '2~3문장, 약 150자',
            coreStrategy: '스토리에서 얻은 교훈을 요약하여 인상 깊게 마무리',
            keyMoves: ['핵심 교훈 요약', '독자에게 적용 유도', '긍정적 미래 제시'],
            dos: ['간결한 메시지 전달', '행동 촉구 포함', '희망적인 어조'],
            donts: ['설교적인 톤', '추상적인 가치 제시', '강압적인 행동 요구']
          }
        ]
      },
      {
        formatName: '실용적인 정보 제공형 포맷',
        formatType: getFormatType(),
        overallStrategy: {
          funnelStage: '관심',
          emotionalArc: '문제 인식 → 호기심 → 안도감 → 신뢰 형성',
          strategicFocus: '실용적인 정보와 팁 제공으로 전문가 포지셔닝 구축',
          recommendedLength: {
            minChars: 500,
            maxChars: 1000
          }
        },
        blocks: [
          {
            name: '문제 제기',
            recommendedLength: '2~3문장, 약 120자',
            coreStrategy: '독자가 겪는 현실적인 문제를 명확히 제시',
            keyMoves: ['통계 수치 제시', '대표적인 사례 언급', '공감 가능한 어조'],
            dos: ['구체적인 문제점 명시', '수치 데이터 활용', '해결 필요성 강조'],
            donts: ['과장된 문제 제기', '추상적인 표현', '두괄어식 구성']
          },
          {
            name: '해결책 제시',
            recommendedLength: '5~7문장, 약 400자',
            coreStrategy: '단계별 해결 방안을 제시하여 실용적 가치 제공',
            keyMoves: ['단계별 구성', '구체적인 예시 포함', '쉬운 언어 사용'],
            dos: ['실제 적용 가능한 팁', '번호 매겨서 제시', '간단한 설명'],
            donts: ['이론적 설명', '복잡한 전문 용어', '추상적인 조언']
          },
          {
            name: '결론 및 행동 유도',
            recommendedLength: '2~3문장, 약 150자',
            coreStrategy: '핵심 요약과 추가 정보 제공으로 전문성 강화',
            keyMoves: ['핵심 내용 재정리', '추가 자료 안내', '신뢰도 강조'],
            dos: ['간결한 요약 제공', '신뢰할 수 있는 근거 제시', '실천 가능한 행동 제안'],
            donts: ['새로운 정보 추가', '강압적인 CTA', '과장된 효과 약속']
          }
        ]
      },
      {
        formatName: '인사이트와 교훈 공유형 포맷',
        formatType: getFormatType(),
        overallStrategy: {
          funnelStage: '인지→관심',
          emotionalArc: '호기심 → 놀람 → 깨달음 → 공감',
          strategicFocus: '새로운 관점과 통찰을 제공하여 지적 만족감 제공',
          recommendedLength: {
            minChars: 300,
            maxChars: 700
          }
        },
        blocks: [
          {
            name: '흥미 유발',
            recommendedLength: '1~2문장, 약 80자',
            coreStrategy: '뜻밖의 사실이나 질문으로 호기심 자극',
            keyMoves: ['반문 제시', '통계적 사실 제시', '일반적 상식과 반대되는 내용'],
            dos: ['흥미로운 통계 활용', '의문형 문장 사용', '짧고 강렬한 표현'],
            donts: ['너무 어려운 전문 내용', '지나치게 긴 설명', '추상적인 개념만 제시']
          },
          {
            name: '인사이트 전개',
            recommendedLength: '4~6문장, 약 350자',
            coreStrategy: '새로운 관점을 제시하고 그 근거를 설명',
            keyMoves: ['구체적인 예시 제시', '비유 활용', '근거 자료 제시'],
            dos: ['이해하기 쉬운 예시', '시각적 비유 사용', '명확한 논리 전개'],
            donts: ['복잡한 이론 설명', '너무 많은 예시 나열', '일방적인 주장']
          },
          {
            name: '교훈 및 적용',
            recommendedLength: '2~3문장, 약 120자',
            coreStrategy: '인사이트를 실제 삶에 적용하는 방법 제시',
            keyMoves: ['실천 가능한 조언', '독자의 상황과 연결', '긍정적 미래 제시'],
            dos: ['실제 적용 가능한 조언', '구체적인 상황 예시', '동기부여하는 표현'],
            donts: ['추상적인 교훈', '모호한 적용 방법', '강요하는 어조']
          }
        ]
      }
    ];
  }

  try {
    const prompt = buildFormatSuggestionPrompt(channelConfig);
    const responseText = await callOpenAIGPT5Generic(prompt);

    // JSON 파싱
    const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.warn('Failed to parse format suggestions, using defaults');
      return [];
    }

    const suggestions = JSON.parse(jsonMatch[0]) as FormatSuggestion[];

    // 유효성 검사 및 2-3개로 제한
    const validSuggestions = suggestions
      .filter(
        (s) =>
          s.formatName &&
          s.formatType &&
          s.overallStrategy &&
          s.overallStrategy.funnelStage &&
          s.overallStrategy.emotionalArc &&
          s.overallStrategy.strategicFocus &&
          s.overallStrategy.recommendedLength &&
          s.overallStrategy.recommendedLength.minChars &&
          s.overallStrategy.recommendedLength.maxChars &&
          s.blocks &&
          Array.isArray(s.blocks) &&
          s.blocks.length > 0
      )
      .slice(0, 3);

    return validSuggestions;
  } catch (error) {
    console.error('Error suggesting formats:', error);
    // Check if it's a quota exceeded error
    if (error instanceof Error && error.message.includes('429 Too Many Requests')) {
      console.error('❌ Gemini API quota exceeded');
      throw new Error('AI API의 일일 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    return [];
  }
}

export async function evaluatePathRelevance(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<RelevanceEvaluation> {
  if (USE_MOCK) {
    // Mock 모드에서는 항상 적합하다고 판단
    return {
      suitable: true,
      confidence: 100,
      reason: 'MOCK 모드: 모든 경로 허용',
    };
  }

  try {
    const prompt = buildRelevancePrompt(inputConfig, channelConfig, formatConfig);
    const responseText = await callOpenAIGPT5Generic(prompt);

    // JSON 파싱 시도
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Failed to parse relevance evaluation, defaulting to suitable');
      return {
        suitable: true,
        confidence: 50,
        reason: 'JSON 파싱 실패, 기본값 사용',
      };
    }

    const evaluation = JSON.parse(jsonMatch[0]) as RelevanceEvaluation;

    // 유효성 검사
    if (typeof evaluation.suitable !== 'boolean') {
      evaluation.suitable = true;
    }
    if (typeof evaluation.confidence !== 'number') {
      evaluation.confidence = 50;
    }
    if (typeof evaluation.reason !== 'string') {
      evaluation.reason = '이유 없음';
    }

    return evaluation;
  } catch (error) {
    console.error('Error evaluating path relevance:', error);
    // 에러 시 안전하게 통과
    return {
      suitable: true,
      confidence: 50,
      reason: '평가 오류, 기본 허용',
    };
  }
}

/**
 * 이미지 생성 프롬프트 빌드
 */
function buildImageGenerationPrompt(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): string {
  return `You are a professional image prompt engineer. Create a detailed, high-quality image generation prompt based on the following information.

[Channel Context]
Channel: ${channelConfig.channelType}
Brand/Channel Description: ${channelConfig.channelKnowledge}
Persona: ${channelConfig.personaTags.join(', ')}
Tone: ${channelConfig.toneTags.join(', ')}

[Input Data]
Topic: ${inputConfig.topic}
Raw Data: ${inputConfig.rawData}

[Image Style]
${formatConfig.formatStructureDescription}

[Key Elements and Composition]
${formatConfig.formatExampleText}

Create a detailed English image generation prompt that:
1. Incorporates the topic and key information from the input data
2. Follows the specified image style
3. Includes all key elements and composition requirements
4. Is optimized for AI image generation models (Stable Diffusion, DALL-E, etc.)
5. Uses specific, descriptive language
6. Specifies camera angle, lighting, mood, color palette when relevant

Output ONLY the English image generation prompt, nothing else. Make it detailed (50-100 words).`;
}

/**
 * Mock 이미지 생성 (개발용)
 * 실제로는 Imagen, DALL-E, Stable Diffusion 등의 API를 호출해야 함
 */
function generateMockImage(prompt: string): string {
  // SVG를 base64로 인코딩하여 반환
  // 실제 구현에서는 이미지 생성 API 호출
  const svg = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#grad1)"/>
    <text x="50%" y="40%" text-anchor="middle" fill="white" font-size="24" font-family="Arial, sans-serif">
      이미지 생성 (개발 모드)
    </text>
    <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="16" font-family="Arial, sans-serif" opacity="0.8">
      실제 환경에서는 Gemini가 생성한 프롬프트로
    </text>
    <text x="50%" y="55%" text-anchor="middle" fill="white" font-size="16" font-family="Arial, sans-serif" opacity="0.8">
      이미지 생성 API를 호출합니다
    </text>
    <text x="50%" y="65%" text-anchor="middle" fill="white" font-size="12" font-family="monospace" opacity="0.6">
      ${prompt.substring(0, 60)}...
    </text>
  </svg>`;

  // SVG를 base64로 인코딩
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Gemini 2.5 Flash Image로 실제 이미지 생성
 */
async function callGeminiImageAPI(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  try {
    console.log('🖼️  Gemini 2.5 Flash Image 모델로 이미지 생성 중...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    const result = await model.generateContent([prompt]);
    const response = await result.response;

    // 응답에서 이미지 데이터 추출
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      // @ts-ignore - inlineData는 타입 정의에 없을 수 있음
      if (part.inlineData && part.inlineData.data) {
        // @ts-ignore
        const base64Data = part.inlineData.data;
        // @ts-ignore
        const mimeType = part.inlineData.mimeType || 'image/png';
        console.log('✅ 이미지 생성 완료!');
        return `data:${mimeType};base64,${base64Data}`;
      }
    }

    throw new Error('No image data found in response');
  } catch (error) {
    console.error('Gemini Image API error:', error);
    throw error;
  }
}

/**
 * 이미지 생성 메인 함수
 * Gemini 2.5 Flash Image를 사용하여 실제 이미지 생성
 */
export async function generateImage(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<{ imageData: string; promptUsed: string }> {
  console.log('이미지 생성 시작...');

  if (USE_MOCK) {
    console.log('MOCK 모드: 샘플 이미지 생성');
    const mockPrompt = `A professional marketing image for ${channelConfig.channelType} channel about ${inputConfig.topic}`;
    return {
      imageData: generateMockImage(mockPrompt),
      promptUsed: mockPrompt,
    };
  }

  try {
    // 1단계: Gemini Pro로 상세한 이미지 생성 프롬프트 작성
    const promptGenerationPrompt = buildImageGenerationPrompt(
      inputConfig,
      channelConfig,
      formatConfig
    );

    console.log('📝 GPT-5로 이미지 프롬프트 생성 중...');
    const imagePrompt = await callOpenAIGPT5Generic(promptGenerationPrompt);

    console.log('생성된 이미지 프롬프트:', imagePrompt.substring(0, 100) + '...');

    // 2단계: Gemini 2.5 Flash Image로 실제 이미지 생성
    console.log('🎨 Gemini 2.5 Flash Image로 이미지 생성 중...');
    const imageData = await callGeminiImageAPI(imagePrompt);

    return {
      imageData,
      promptUsed: imagePrompt,
    };
  } catch (error) {
    console.error('이미지 생성 오류:', error);
    const fallbackPrompt = `Error generating image for ${inputConfig.topic}`;

    // 에러 발생 시 fallback으로 mock 이미지 반환
    console.log('⚠️  에러로 인해 placeholder 이미지 반환');
    return {
      imageData: generateMockImage(fallbackPrompt),
      promptUsed: fallbackPrompt,
    };
  }
}

/**
 * ========================================
 * Gamma API 관련 함수들
 * ========================================
 */

/**
 * Gamma Generate API 호출
 */
async function callGammaGenerateAPI(
  inputText: string,
  options: {
    numCards?: number;
    tone?: string;
    audience?: string;
    detailLevel?: string;
    imageSources?: string[];
    additionalInstructions?: string;
  }
): Promise<{ url: string; id: string }> {
  if (!GAMMA_API_KEY) {
    throw new Error('GAMMA_API_KEY가 설정되지 않았습니다');
  }

  // API 키 확인 로그 (앞 6자리만)
  console.log(`🔑 Gamma API 키 확인: ${GAMMA_API_KEY.substring(0, 6)}...`);

  const BASE_URL = 'https://public-api.gamma.app/v1.0';

  // API 요청 본문 구성
  const requestBody: any = {
    inputText,
    textMode: 'generate',
    format: 'social',
    numCards: options.numCards || 1,
  };

  // textOptions 추가 (detailLevel 제외 - Gamma API에서 지원하지 않음)
  if (options.tone || options.audience) {
    requestBody.textOptions = {};
    if (options.tone) requestBody.textOptions.tone = options.tone;
    if (options.audience) requestBody.textOptions.audience = options.audience;
  }

  // imageOptions 추가
  if (options.imageSources && options.imageSources.length > 0) {
    const sources = options.imageSources.filter(s => s !== 'none');
    if (sources.length > 0) {
      requestBody.imageOptions = {
        sources: sources,
      };
    }
  }

  // 추가 지시사항
  if (options.additionalInstructions) {
    requestBody.additionalInstructions = options.additionalInstructions;
  }

  console.log('🚀 Gamma API 호출 중...', { numCards: requestBody.numCards });

  try {
    const response = await fetch(`${BASE_URL}/generations`, {
      method: 'POST',
      headers: {
        'X-API-Key': GAMMA_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gamma API 오류 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      url?: string;
      webUrl?: string;
      id?: string;
      gammaId?: string;
      [key: string]: unknown; // 다른 필드도 허용
    };
    
    // 실제 응답 구조 확인을 위한 로깅
    console.log('📋 Gamma API 응답:', JSON.stringify(data, null, 2));
    console.log('✅ Gamma 소셜 포스트 생성 완료!');

    // Gamma API 응답에서 generationId 추출
    // 실제 응답: {"generationId":"dkt0mUvP0dQQwSbb6UMaF"}
    const generationId = data.generationId;
    console.log('🎯 Gamma API 응답:', { generationId });

    if (!generationId) {
      console.error('❌ GenerationId 없음:', data);
      throw new Error('Gamma API 응답에 generationId가 없습니다.');
    }

    // Gamma URL 생성 (generationId를 포함)
    const gammaUrl = `https://gamma.app/generations/${generationId}`;

    return {
      url: gammaUrl,
      id: generationId,
    };
  } catch (error) {
    console.error('Gamma API 호출 오류:', error);
    throw error;
  }
}

/**
 * Gamma 소셜 포스트 생성 (메인 함수)
 */
export async function generateGammaSocialPost(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<{ gammaUrl: string; inputText: string }> {
  console.log('📱 Gamma 소셜 포스트 생성 시작...');

  // inputText 구성 (채널 정보 + 입력 데이터)
  const inputText = `
채널: ${channelConfig.channelType}
페르소나: ${channelConfig.personaTags.join(', ')}
톤: ${channelConfig.toneTags.join(', ')}
채널 설명: ${channelConfig.channelKnowledge}

톤앤매너 참고:
${channelConfig.toneMannerExample}

주제: ${inputConfig.topic}
내용:
${inputConfig.rawData}
`.trim();

  console.log('📝 Input Text 길이:', inputText.length, '자');
  console.log("[SERVER] Gamma API 호출 직전 - formatConfig:", JSON.stringify({
    numCards: formatConfig.gammaNumCards,
    tone: formatConfig.gammaTone,
    audience: formatConfig.gammaAudience
  }));

  try {
    const result = await callGammaGenerateAPI(inputText, {
      numCards: formatConfig.gammaNumCards || 1,
      tone: formatConfig.gammaTone,
      audience: formatConfig.gammaAudience,
      imageSources: formatConfig.gammaImageSources,
      additionalInstructions: formatConfig.gammaAdditionalInstructions,
    });

    return {
      gammaUrl: result.url,
      inputText,
    };
  } catch (error) {
    console.error('Gamma 소셜 포스트 생성 오류:', error);
    throw error;
  }
}

/**
 * 범용 OpenAI GPT-5 API 호출 함수
 */
export async function callOpenAIGPT5Generic(
  prompt: string
): Promise<string> {
  console.log('🚀 GPT-5.1 일반 호출 시작...');
  console.log(`📊 프롬프트 길이: ${prompt.length}자`);

  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant. Please provide clear and accurate responses to the user's requests."
    },
    {
      role: "user",
      content: prompt
    }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "gpt-5.1", // GPT-5.1 모델 사용 (최신 고성능 모델)
      messages: messages,
      temperature: 0.7,
      max_completion_tokens: 8000, // GPT-5.1은 max_completion_tokens 사용
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🔥 OpenAI API 오류 상세:', {
      status: response.status,
      statusText: response.statusText,
      errorText: errorText,
    });
    throw new Error(`OpenAI API 오류 (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // API 응답 구조 검증
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('❌ API 응답 구조 오류:', JSON.stringify(data, null, 2));
    throw new Error('OpenAI API 응답 구조가 올바르지 않습니다.');
  }

  const content = data.choices[0].message.content;

  if (!content || content.trim() === '') {
    console.error('❌ 응답 내용 없음:', data);
    throw new Error('OpenAI 응답에 내용이 없습니다.');
  }

  console.log('✅ GPT-5.1 일반 호출 성공');
  return content;
}

/**
 * OpenAI GPT-5 API 호출 함수 (레퍼런스 기반 포맷 생성)
 */
export async function callOpenAIGPT5(
  channelType: string,
  referenceText: string,
  targetLanguage: string = 'ko'
): Promise<{
  formatName: string;
  formatType: "포스트" | "일반이미지" | "소셜포스트" | "뉴스레터" | "기타";
  overallStrategy: {
    funnelStage: string;
    emotionalArc: string;
    strategicFocus: string;
    recommendedLength: {
      minChars: number;
      maxChars: number;
    };
  };
  blocks: Array<{
    name: string;
    recommendedLength: string;
    coreStrategy: string;
    keyMoves: string[];
    dos: string[];
    donts: string[];
  }>;
}> {
  console.log('🚀 GPT-5 호출 시작...');
  console.log(`📊 레퍼런스 텍스트 길이: ${referenceText.length}자`);

  // 레퍼런스 텍스트 길이에 따른 동적 처리
  let processedReferenceText = referenceText;
  if (referenceText.length > 300) { // 임계값을 300자로 더 낮춤
    // 긴 텍스트는 핵심 부분만 추출 (처음 150자 + 마지막 150자)
    const firstPart = referenceText.substring(0, 150);
    const lastPart = referenceText.substring(referenceText.length - 150);
    processedReferenceText = `${firstPart}\n\n...\n\n${lastPart}`;
    console.log(`🔄 긴 텍스트(${referenceText.length}자)를 핵심 부분으로 압축: ${processedReferenceText.length}자`);
  }

  // 시스템 프롬프트 (GPT-5.1용)
  const SYSTEM_PROMPT = `[목적]

이 프롬프트의 목적은, 사용자가 제공한 레퍼런스 텍스트를 읽고
그 글의 "구조, 흐름, 후킹/전개/마무리 패턴"을 그대로 유지하면서
주제·사례·고유명사는 제거한 일반화된 콘텐츠 포맷 정의를 만드는 것이다.

출력은 항상 같은 JSON 스키마를 사용하며,
각 블록의 길이와 역할은 레퍼런스 글의 실제 구성을 최대한 충실하게 반영해야 한다.

[입력]

- targetLanguage: 결과를 출력할 언어 코드 (예: "ko", "en")
- referenceText: 레퍼런스가 되는 실제 글 전체

[해야 할 작업]

1. referenceText를 처음부터 끝까지 읽고,
   글이 어떤 순서로 전개되는지, 어디에서 전환이 일어나는지, 어떻게 마무리되는지 파악한다.

2. 이 글을 여러 개의 "전략적 블록"으로 나눈다고 가정하고,
   각 블록이 어떤 역할을 하는지, 어느 정도 길이인지, 어떤 방식으로 메시지를 전달하는지 분석한다.

3. 레퍼런스에 나오는 구체적인 주제, 사례, 회사/사람 이름, 숫자, 날짜는 모두 제거하거나 일반화하고,
   대신 "이 포맷에서는 어떤 역할의 블록이 어떤 길이로, 어떤 식으로 독자에게 말을 거는지"만 남긴다.

4. 분석 결과를 아래 JSON 스키마에 맞게 채운다.
   이때, JSON 필드 이름과 구조는 절대 변경하지 않는다.

3. **주요 기법 (Key Moves)**: 구체적인 마케팅 심리학 기법 (3-5개)
   - 예시: '제로 프라이싱 효과 활용', '권위자 편향 활용', '닻 효과(Anchoring Effect) 적용', '확증 편향 활용', '가격 프레이밍 효과'

4. **실행 지침 (Dos)**: 반드시 해야 할 긍정적 행동 지침 (3-5개)
   - 예시: '구체적인 수치로 신뢰도 제시', '실제 고객 사례 인용', '감정적 소구와 이성적 소구 균형'

5. **금지사항 (Donts)**: 반드시 피해야 할 부정적 행동 지침 (3-5개)
   - 예시: '과장된 주장 사용 금지', '모호한 표현 자제', '부정적 비교 사용 금지'

## 전략적 깊이 강화 가이드
- 각 블록의 핵심전략은 명확한 마케팅 목적을 제시해야 함 (예: "인지적 불일치 해소를 통한 신뢰 구축", "사회적 증거를 활용한 권위자 포지셔닝")
- 주요 기법은 구체적인 심리학적 트리거와 행동 유도 기법을 포함해야 함 (예: "제로 프라이싱 효과", "손실 회피 심리", "권위자 편향 활용")
- Dos/Donts는 즉시 적용 가능한 구체적인 행동 지침이어야 함

규칙:
- 레퍼런스 텍스트의 문장을 10단어 이상 연속으로 재사용하지 마라.
- 회사명, 사람 이름, 서비스명, 특정 플랫폼명, 구체적인 숫자와 날짜는
  "한 소셜 플랫폼", "한 SaaS 서비스", "어느 시점", "몇 퍼센트"와 같이 일반화해서만 언급하라.
- 전략을 설명할 때는 레퍼런스 글을 직접 언급하지 말고,
  "이 포맷에서는 ~한 방식으로 독자의 공감을 유도한다"처럼 일반화된 설명만 사용하라.
- **핵심 전략 분석 시 구체적인 데이터, 예시, 키워드 언급을 최소화하고 오직 마케팅 전략적 측면에만 집중하라.**
  - "특정 키워드", "특정 데이터", "예시" 등의 언급 대신 "관련 키워드", "관련 데이터", "관련 사례" 등으로 일반화하라
  - 전략적 접근법, 심리적 트리거, 행동 유도 메커니즘 등 마케팅 원리에 집중하라
  - 어떤 주제에도 적용 가능한 보편적인 전략 템플릿으로 설계하라

**생성 가이드라인 (안정성 확보):**
- blocks 배열은 최대 10개까지 생성하되, 전략적 흐름에 맞는 핵심 블록들을 포함하라
- 각 블록의 dos/donts 배열은 각각 최대 6개까지 허용하라
- keyMoves 배열은 최대 8개까지 허용하라
- 전체 JSON 응답 길이가 과도하게 길어지지 않도록 간결하게 유지하라
- **각 블록의 keyMoves는 구체적인 마케팅 기법과 심리적 전략을 중심으로 구성하라**

- 출력은 아래 JSON 스키마 형식에 정확히 맞춰라.
- JSON 이외의 자연어 문장을 추가하지 마라.

반드시 다음 JSON 형식으로만 응답하라. 자연어 설명을 덧붙이지 마라.

{
  "formatName": string,
  "formatType": "포스트" | "일반이미지" | "소셜포스트" | "뉴스레터" | "기타",
  "overallStrategy": {
    "funnelStage": "string (인지/관심/고려/행동 단계 중 선택)",
    "emotionalArc": "string (구체적인 감정적 변화 과정: 예: '호기심→공감→신뢰→행동 의지')",
    "strategicFocus": "string (주요 전략적 집점: 예: '사회적 증거를 통한 신뢰 구축', '손실 회피 심리 활용', '전문성 포지셔닝')",
    "recommendedLength": {
      "minChars": number,
      "maxChars": number
    }
  },
  "blocks": [
    {
      "name": "string",
      "recommendedLength": "string (구체적인 권장길이: 예: '3~5문장', '200~300자', '1~2분 분량')",
      "coreStrategy": "string (해당 블록의 핵심 전략: 예: '인지적 불일치 해소를 통한 신뢰 구축', '문제 인식을 통한 긴장감 형성')",
      "keyMoves": ["string (구체적인 마케팅 심리학 기법: 예: '제로 프라이싱 효과 활용', '사회적 증거 제시', '권위자 편향 활용', '손실 회피 심리')"],
      "dos": ["string (반드시 해야 할 긍정적 행동 지침)"],
      "donts": ["string (반드시 피해야 할 부정적 행동 지침)"]
    }
  ]
}

제약:
- funnelStage, emotionalArc는 targetLanguage(${targetLanguage})로 작성
- blocks의 모든 필드값은 targetLanguage(${targetLanguage})로 작성

${referenceText.length > 300 ?
  `참고: 레퍼런스 텍스트가 길어 핵심 부분(처음 150자 + 마지막 150자)만 제공됩니다. 전체 구조를 파악하는 데 중점을 주세요.` :
  ''
}`

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: `채널 타입: ${channelType}` },
        { type: "text", text: `타겟 언어: ${targetLanguage}` },
        { type: "text", text: "레퍼런스 텍스트:" },
        { type: "text", text: processedReferenceText }
      ]
    }
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-5.1", // GPT-5.1 모델
        messages: messages,
        temperature: 0.4,
        max_completion_tokens: 8000, // GPT-5.1을 위한 충분한 토큰 수
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔥 OpenAI API 오류 상세:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        requestBody: JSON.stringify({
          model: "gpt-5.1",
          messages: messages,
          temperature: 0.4,
          max_completion_tokens: 8000,
        }, null, 2)
      });
      throw new Error(`OpenAI API 오류 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // API 응답 구조 검증
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ API 응답 구조 오류:', JSON.stringify(data, null, 2));
      throw new Error('OpenAI API 응답 구조가 올바르지 않습니다.');
    }

    const content = data.choices[0].message.content;

    if (!content || content.trim() === '') {
      console.error('❌ 응답 내용 없음:', data);
      throw new Error('OpenAI 응답에 내용이 없습니다.');
    }

    console.log('📝 GPT-5 원본 응답:', content);

    // JSON 파싱 (안전장치)
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ JSON 파싱 실패:', content);
      throw new Error('응답에서 JSON을 찾을 수 없습니다.');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('❌ JSON 파싱 오류:', parseError);
      throw new Error('JSON 파싱에 실패했습니다.');
    }

    // 결과 검증
    if (!parsed.formatName || !parsed.blocks || !Array.isArray(parsed.blocks)) {
      throw new Error('응답 형식이 올바르지 않습니다.');
    }

    // 안전/유사성 제약 검증
    console.log('🔒 안전/유사성 제약 검증 시작...');

    // 1. 10단어 이상 연속 중복 검증
    const similarityCheck = validateTextSimilarity(JSON.stringify(parsed), referenceText);
    if (!similarityCheck.isValid) {
      console.warn('⚠️ 10단어 이상 연속 중복 발견:', similarityCheck.violations.length, '건');

      // 위반 내용 로깅
      similarityCheck.violations.forEach((violation, index) => {
        console.warn(`  위반 ${index + 1}: "${violation.text.substring(0, 50)}..."`);
      });

      // 심각한 경우 (3건 이상)는 오류 처리
      if (similarityCheck.violations.length >= 3) {
        throw new Error(`텍스트 유사성 제약 위반: 10단어 이상 연속 중복이 ${similarityCheck.violations.length}건 발견되었습니다.`);
      }
    }

    // 2. 개체명 일반화 검증 및 처리
    const originalResult = JSON.stringify(parsed);
    const generalizedResult = generalizeText(originalResult);

    if (originalResult !== generalizedResult) {
      console.log('🔄 민감 정보 일반화 처리됨');
      try {
        parsed = JSON.parse(generalizedResult);
      } catch (parseError) {
        console.warn('⚠️ 일반화 처리 중 오류 발생, 원본 결과 유지:', parseError);
      }
    }

    // 3. 최종 결과 검증
    if (!parsed.formatName || !parsed.blocks || !Array.isArray(parsed.blocks)) {
      throw new Error('처리 후 응답 형식이 올바르지 않습니다.');
    }

    console.log('✅ GPT-5 포맷 생성 성공 (안전 검증 통과):', parsed.formatName);
    return parsed;

  } catch (error) {
    console.error('GPT-5 호출 오류:', error);
    throw error;
  }
}
