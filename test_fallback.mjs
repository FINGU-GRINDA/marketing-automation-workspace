import { callGemini3ProPreviewGeneric } from './src/server/aiClient.ts';

async function testFallback() {
  console.log('=== Fallback 메커니즘 테스트 ===\n');

  try {
    console.log('1. B2B 이메일 관련 프롬프트 테스트...');
    const b2bResponse = await callGemini3ProPreviewGeneric('B2B 콜드 이메일 작성해줘. 자동차 주차 SI 업체에 제안하는 내용이야.');
    console.log('B2B 응답:', b2bResponse);
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('2. 전략 관련 프롬프트 테스트...');
    const strategyResponse = await callGemini3ProPreviewGeneric('마케팅 전략 플랜을 세워줘.');
    console.log('전략 응답:', strategyResponse);
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('3. 제안 관련 프롬프트 테스트...');
    const proposeResponse = await callGemini3ProPreviewGeneric('신규 프로젝트 제안서를 작성해줘.');
    console.log('제안 응답:', proposeResponse);
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('4. 기본 프롬프트 테스트...');
    const basicResponse = await callGemini3ProPreviewGeneric('일반적인 콘텐츠를 생성해줘.');
    console.log('기본 응답:', basicResponse);

  } catch (error) {
    console.error('테스트 실패:', error);
  }
}

testFallback();