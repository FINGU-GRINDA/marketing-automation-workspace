import { callOpenAIGPT5Generic } from './src/server/aiClient.ts';

async function testOpenAI() {
  console.log('=== OpenAI GPT-5.1 통합 테스트 ===\n');

  try {
    console.log('1. 기본 테스트...');
    const basicResponse = await callOpenAIGPT5Generic('안녕하세요! 간단하게 인사해주세요.');
    console.log('기본 응답:', basicResponse);
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('2. 마케팅 관련 테스트...');
    const marketingResponse = await callOpenAIGPT5Generic('B2B 마케팅 콘텐츠를 작성하는 방법을 간략히 알려주세요.');
    console.log('마케팅 응답:', marketingResponse);
    console.log('\n' + '='.repeat(50) + '\n');

    console.log('3. 시스템 메시지 테스트...');
    const systemResponse = await callOpenAIGPT5Generic('당신은 전문 마케터입니다. 디지털 마케팅의 핵심 전략을 3가지로 요약해주세요.', {
      systemMessage: '당신은 10년 경력의 디지털 마케팅 전문가입니다. 답변은 전문적이고 간결해야 합니다.'
    });
    console.log('시스템 메시지 응답:', systemResponse);

    console.log('\n✅ 모든 테스트 성공!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testOpenAI();