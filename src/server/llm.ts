import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  InputNodeConfig,
  ChannelNodeConfig,
  ContentFormatNodeConfig,
} from './types.js';

// 환경 변수에서 API 키 가져오기 (없으면 mock 모드)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_MOCK = !GEMINI_API_KEY;

// Gemini 클라이언트 초기화
const genAI = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : null;

/**
 * 프롬프트 빌드 함수 (콘텐츠 유형별 분기)
 */
export function buildPrompt(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): string {
  const contentType = formatConfig.mappedContentType;

  // 공통 채널 정보
  const channelInfo = `채널: ${channelConfig.channelType}
- 페르소나 태그: ${channelConfig.personaTags.join(', ')}
- 톤 태그: ${channelConfig.toneTags.join(', ')}
- 채널/브랜드 설명: ${channelConfig.channelKnowledge}

톤앤매너 예시 (말투와 어감만 참고, 내용 복사 금지):
${channelConfig.toneMannerExample}
${channelConfig.prohibitedTypes && channelConfig.prohibitedTypes.length > 0 ? `\n절대 금지된 콘텐츠 유형:\n${channelConfig.prohibitedTypes.map(type => `- ${type}`).join('\n')}\n` : ''}
[INPUT_DATA]
Topic: ${inputConfig.topic}
RawData: ${inputConfig.rawData}`;

  // 콘텐츠 유형별 프롬프트
  switch (contentType) {
    case '포스트':
      return `너는 ${channelConfig.channelType} 채널에 포스트를 작성하는 마케터다.

${channelInfo}

반드시 지켜야 할 규칙:
1) 글의 소재/사실 정보는 오직 INPUT_DATA에서만 가져온다.
2) FORMAT_EXAMPLE의 문장/사실은 절대 복사하지 말고, 톤과 구성만 참고한다.
3) 글의 전체 구조는 FORMAT_STRUCTURE를 따른다.

[FORMAT_STRUCTURE]
${formatConfig.formatStructureDescription}

[FORMAT_EXAMPLE]
${formatConfig.formatExampleText}

위 정보를 바탕으로 포스트를 작성해라.
${formatConfig.generationPromptTemplate}
결과를 하나의 완성된 텍스트로 출력해라.`;

    case '일반이미지':
      return `너는 ${channelConfig.channelType} 채널의 이미지를 기획하는 크리에이티브 디렉터다.

${channelInfo}

[이미지 스타일]
${formatConfig.formatStructureDescription}

[주요 요소 및 구성]
${formatConfig.formatExampleText}

위 정보를 바탕으로 이미지 생성 프롬프트를 작성해라.
${formatConfig.generationPromptTemplate}

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

    case '텍스트형 이미지':
      return `너는 ${channelConfig.channelType} 채널의 텍스트형 이미지를 기획하는 디자이너다.

${channelInfo}

[텍스트 레이아웃]
${formatConfig.formatStructureDescription}

[디자인 가이드]
${formatConfig.formatExampleText}

위 정보를 바탕으로 텍스트형 이미지 콘텐츠를 작성해라.
${formatConfig.generationPromptTemplate}

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

    case '보고서':
      return `너는 ${channelConfig.channelType} 채널을 위한 보고서를 작성하는 애널리스트다.

${channelInfo}

반드시 지켜야 할 규칙:
1) 데이터와 사실은 오직 INPUT_DATA에서만 가져온다.
2) 전문적이고 객관적인 어조를 유지한다.
3) 보고서 구조를 명확하게 구분한다.

[보고서 구조]
${formatConfig.formatStructureDescription}

[보고서 예시 형식]
${formatConfig.formatExampleText}

위 정보를 바탕으로 보고서를 작성해라.
${formatConfig.generationPromptTemplate}

보고서 형식으로 섹션을 명확히 구분하여 출력해라.`;

    default:
      // 기본 포스트 프롬프트
      return `너는 ${channelConfig.channelType} 채널에 콘텐츠를 작성하는 마케터다.

${channelInfo}

[FORMAT_STRUCTURE]
${formatConfig.formatStructureDescription}

[FORMAT_EXAMPLE]
${formatConfig.formatExampleText}

위 정보를 바탕으로 ${contentType} 유형의 콘텐츠를 작성해라.
${formatConfig.generationPromptTemplate}
결과를 하나의 완성된 텍스트로 출력해라.`;
  }
}

/**
 * Gemini API 호출 (실제)
 */
async function callGeminiAPI(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  try {
    // gemini-2.5-pro 모델 사용
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return text;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
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
 * LLM 호출 메인 함수 (Mock/Real 자동 선택)
 */
export async function callLLM(
  inputConfig: InputNodeConfig,
  channelConfig: ChannelNodeConfig,
  formatConfig: ContentFormatNodeConfig
): Promise<string> {
  const prompt = buildPrompt(inputConfig, channelConfig, formatConfig);

  if (USE_MOCK) {
    console.log('Using MOCK LLM response (GEMINI_API_KEY not set)');
    return generateMockResponse(inputConfig, channelConfig, formatConfig);
  }

  console.log('Calling Gemini API (gemini-2.5-pro)...');
  return await callGeminiAPI(prompt);
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
    const responseText = await callGeminiAPI(prompt);

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
    const responseText = await callGeminiAPI(prompt);

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
  name: string;
  mappedContentType: string;
  formatStructureDescription: string;
  formatExampleText: string;
  generationPromptTemplate: string;
}

function buildFormatSuggestionPrompt(channelConfig: ChannelNodeConfig): string {
  return `당신은 콘텐츠 마케팅 전문가입니다. 주어진 채널 정보를 분석하여 가장 적합한 콘텐츠 포맷 2-3개를 제안해야 합니다.

[채널 정보]
채널 타입: ${channelConfig.channelType}
채널 이름: ${channelConfig.name}
페르소나 태그: ${channelConfig.personaTags.join(', ') || '없음'}
톤 태그: ${channelConfig.toneTags.join(', ') || '없음'}
콘텐츠 태그: ${channelConfig.highLevelContentTags.join(', ') || '없음'}
채널 지식/브랜드 설명: ${channelConfig.channelKnowledge || '없음'}
톤앤매너 예시: ${channelConfig.toneMannerExample || '없음'}

위 채널에 가장 적합한 콘텐츠 포맷을 2-3개 제안하세요. 각 포맷은:
1. 채널의 톤앤매너와 페르소나에 맞아야 함
2. 콘텐츠 태그와 연관성이 있어야 함
3. 실제로 활용 가능한 구체적인 포맷이어야 함

응답 형식 (JSON 배열):
[
  {
    "name": "포맷 이름 (예: 스토리텔링, 하우투, 리스트형 등)",
    "mappedContentType": "콘텐츠 유형 (예: 블로그 포스트, 인스타 캡션, 유튜브 스크립트 등)",
    "formatStructureDescription": "이 포맷의 구조를 자세히 설명 (예: 도입-본론-결론, 문제제시-해결방안-CTA 등)",
    "formatExampleText": "이 채널의 톤앤매너를 반영한 실제 예시 텍스트 (200-300자)",
    "generationPromptTemplate": "AI가 이 포맷으로 글을 쓸 때 참고할 추가 지침"
  }
]

**중요**:
- 반드시 2-3개의 포맷만 제안
- 각 포맷은 서로 다른 스타일/목적을 가져야 함
- formatExampleText는 실제 이 채널에서 사용할 법한 구체적인 예시
- JSON 배열만 반환`;
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

    return [
      {
        name: '스토리텔링',
        mappedContentType: `${channelConfig.channelType} 스토리`,
        formatStructureDescription: '도입(공감) → 전개(이야기) → 결론(메시지/교훈)',
        formatExampleText: `${channelConfig.name} 채널의 ${toneText} 톤으로 ${personaText}를 대상으로 작성된 이야기 형식의 콘텐츠입니다. 독자가 공감할 수 있는 경험을 중심으로 전개됩니다.`,
        generationPromptTemplate: '스토리텔링 형식으로 작성하되, 독자가 공감할 수 있는 경험을 중심으로 전개하세요.',
      },
      {
        name: '하우투',
        mappedContentType: `${channelConfig.channelType} 가이드`,
        formatStructureDescription: '문제 제시 → 단계별 해결방안 → 요약/팁',
        formatExampleText: `${channelConfig.name} 채널에서 ${personaText}를 위해 ${toneText} 톤으로 실용적인 정보를 전달하는 가이드입니다.`,
        generationPromptTemplate: '실용적이고 따라하기 쉬운 단계별 가이드 형식으로 작성하세요.',
      },
      {
        name: '팁공유',
        mappedContentType: `${channelConfig.channelType} 팁`,
        formatStructureDescription: '핵심 팁 소개 → 각 팁 상세 설명 → 적용 방법',
        formatExampleText: `${channelConfig.name} 채널에서 ${toneText} 톤으로 ${personaText}에게 유용한 팁을 공유하는 형식입니다. 간결하고 실용적인 정보 전달에 중점을 둡니다.`,
        generationPromptTemplate: '간결하고 실용적인 팁 형식으로 작성하되, 각 팁이 바로 적용 가능하도록 구체적으로 설명하세요.',
      },
    ];
  }

  try {
    const prompt = buildFormatSuggestionPrompt(channelConfig);
    const responseText = await callGeminiAPI(prompt);

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
          s.name &&
          s.mappedContentType &&
          s.formatStructureDescription &&
          s.formatExampleText &&
          s.generationPromptTemplate
      )
      .slice(0, 3);

    return validSuggestions;
  } catch (error) {
    console.error('Error suggesting formats:', error);
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
    const responseText = await callGeminiAPI(prompt);

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

[Additional Instructions]
${formatConfig.generationPromptTemplate}

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
 * 이미지 생성 메인 함수
 * Gemini로 프롬프트를 생성하고, 이미지 생성 API를 호출
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
    // 1단계: Gemini로 상세한 이미지 생성 프롬프트 작성
    const promptGenerationPrompt = buildImageGenerationPrompt(
      inputConfig,
      channelConfig,
      formatConfig
    );

    console.log('Gemini로 이미지 프롬프트 생성 중...');
    const imagePrompt = await callGeminiAPI(promptGenerationPrompt);

    console.log('생성된 이미지 프롬프트:', imagePrompt.substring(0, 100) + '...');

    // 2단계: 실제 이미지 생성
    // TODO: 실제 구현에서는 Imagen, DALL-E, Stable Diffusion 등의 API 호출
    // 현재는 개발용 placeholder 이미지 반환
    console.log('⚠️  실제 이미지 생성 API 미구현 - placeholder 이미지 반환');
    const imageData = generateMockImage(imagePrompt);

    return {
      imageData,
      promptUsed: imagePrompt,
    };
  } catch (error) {
    console.error('이미지 생성 오류:', error);
    const fallbackPrompt = `Error generating image for ${inputConfig.topic}`;
    return {
      imageData: generateMockImage(fallbackPrompt),
      promptUsed: fallbackPrompt,
    };
  }
}
