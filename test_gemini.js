// Gemini 3 Pro Preview API 스모크 테스트
import { callGemini3ProPreviewGeneric } from './dist/server/aiClient.js';

async function runGeminiSmokeTest() {
  console.log('🧪 Gemini 3 Pro Preview 스모크 테스트 시작...');

  try {
    const testPrompt = "테스트용 프롬프트입니다. 간단한 응답을 주세요.";
    console.log('📝 테스트 프롬프트:', testPrompt);

    const response = await callGemini3ProPreviewGeneric(testPrompt);

    console.log('✅ Gemini 호출 성공');
    console.log('📝 응답 앞부분 (200자):', response.substring(0, 200));
    console.log('📏 전체 응답 길이:', response.length);

  } catch (error) {
    console.error('❌ Gemini 호출 실패');
    console.error('🔍 에러 정보:', error.message);
    if (error.stack) {
      console.error('🔍 스택트 트레이스:', error.stack);
    }
  }
}

// 함수 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runGeminiSmokeTest };
}

// 직접 실행 (Node.js 환경)
if (import.meta.url === `file://${process.argv[1]}`) {
  runGeminiSmokeTest().catch(console.error);
}