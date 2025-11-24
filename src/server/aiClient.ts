// AI Client - OpenAI GPT-5.1 통합 모듈
// 환경변수에서만 API 키를 읽어오도록 통일
import https from 'https';

const MODEL = "gpt-5.1";

/**
 * OpenAI GPT-5.1 API 호출 함수
 * @param prompt - LLM에 전달할 프롬프트 텍스트
 * @param options - 선택적 옵션 (systemMessage 등)
 * @returns LLM 응답 텍스트
 */
export async function callOpenAIGPT5Generic(prompt: string, options?: { systemMessage?: string }): Promise<string> {
  // 1. 환경변수 검증 - process.env.OPENAI_API_KEY만 사용
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is missing. Please set OPENAI_API_KEY in your environment variables.");
    console.error('[OpenAI] 환경변수 오류:', error.message);
    throw error;
  }

  console.log('[OpenAI] API 호출 시작...');
  console.log('[OpenAI] 프롬프트 길이:', prompt.length);
  console.log('[OpenAI] 모델:', MODEL);
  console.log('[OpenAI] API 키 앞 6자리:', process.env.OPENAI_API_KEY.substring(0, 6) + '...');

  // 2. 메시지 배열 구성
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (options?.systemMessage) {
    messages.push({ role: 'system', content: options.systemMessage });
  }

  messages.push({ role: 'user', content: prompt });

  // 3. 요청 본문 생성 (OpenAI Chat Completions API 형식)
  const requestBody = JSON.stringify({
    model: MODEL,
    messages: messages,
    temperature: 0.7,
    max_completion_tokens: 8000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  });

  console.log('[OpenAI] 요청 본문 크기:', Buffer.byteLength(requestBody), 'bytes');

  // 4. API 요청 설정
  const requestOptions = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // 절대 하드코딩하지 않음
      'Content-Length': Buffer.byteLength(requestBody)
    },
    timeout: 120000 // 120초 타임아웃
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let responseData = '';

      console.log('[OpenAI] 응답 상태 코드:', res.statusCode);
      console.log('[OpenAI] 응답 헤더:', res.headers);

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          console.log('[OpenAI] 전체 응답 데이터 길이:', responseData.length);

          // 5. 상태 코드 검증
          if (res.statusCode !== 200) {
            let errorDetails;
            try {
              const errorJson = JSON.parse(responseData);
              errorDetails = errorJson.error?.message || responseData;
            } catch {
              errorDetails = responseData;
            }

            const error = new Error(`OpenAI API 오류 (${res.statusCode}): ${errorDetails}`);
            console.error('[OpenAI] HTTP 오류:', error.message);
            return reject(error);
          }

          // 6. 응답 파싱
          let response;
          try {
            response = JSON.parse(responseData);
            console.log('[OpenAI] JSON 파싱 성공');
          } catch (parseError) {
            console.error('[OpenAI] JSON 파싱 실패:', parseError);
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            const error = new Error(`응답 JSON 파싱 실패: ${errorMessage}\n원본 데이터: ${responseData}`);
            return reject(error);
          }

          // 7. 응답 구조 검증
          if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
            const error = new Error('응답에 choices 배열이 없거나 비어있습니다');
            console.error('[OpenAI] 응답 구조 오류 (choices):', response);
            return reject(error);
          }

          const choice = response.choices[0];

          // GPT-5.1 모델의 긴 응답 처리: content가 비어있을 경우 다른 필드 확인
          let generatedText = '';

          if (choice.message && choice.message.content) {
            generatedText = choice.message.content.trim();
          } else if (choice.message && choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            // tool_calls가 있는 경우 해당 내용을 텍스트로 변환
            const toolCall = choice.message.tool_calls[0];
            if (toolCall.function && toolCall.function.arguments) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                generatedText = JSON.stringify(args, null, 2);
              } catch (e) {
                generatedText = toolCall.function.arguments;
              }
            }
          } else if (choice.text) {
            // 이전 버전 API 호환성
            generatedText = choice.text.trim();
          } else if (response.usage && response.usage.completion_tokens === 0) {
            // 토큰이 0인 경우도 처리
            generatedText = '';
          }

          // 여전히 내용이 없는 경우 오류 처리 (그러나 더 자세한 정보 제공)
          if (!generatedText && choice.finish_reason !== 'length') {
            const error = new Error(`응답에 콘텐츠가 없습니다 (finish_reason: ${choice.finish_reason})`);
            console.error('[OpenAI] 응답 구조 오류:', {
              choice,
              hasMessage: !!choice.message,
              hasContent: !!(choice.message && choice.message.content),
              finishReason: choice.finish_reason
            });
            return reject(error);
          }

          // 긴 응답이 잘린 경우 처리
          if (choice.finish_reason === 'length' && !generatedText) {
            const error = new Error('응답이 최대 길이에 도달하여 잘렸지만, 내용을 찾을 수 없습니다. max_tokens를 늘려보세요.');
            console.error('[OpenAI] 응답 길이 제한 오류:', choice);
            return reject(error);
          }

          console.log('[OpenAI] 생성된 텍스트 길이:', generatedText.length);
          console.log('[OpenAI] 생성된 텍스트 앞부분 (100자):', generatedText.substring(0, 100));

          // 8. 성공 응답 반환
          resolve(generatedText);

        } catch (error) {
          console.error('[OpenAI] 응답 처리 중 예외 발생:', error);
          reject(error);
        }
      });
    });

    // 9. 요청 오류 처리
    req.on('error', (error) => {
      console.error('[OpenAI] 요청 오류:', error);
      reject(new Error(`OpenAI API 요청 실패: ${error.message}`));
    });

    // 10. 타임아웃 처리
    req.on('timeout', () => {
      console.error('[OpenAI] 요청 타임아웃 (120초)');
      req.destroy();
      reject(new Error('OpenAI API 요청 타임아웃 (120초)'));
    });

    // 11. 요청 전송
    try {
      req.write(requestBody);
      req.end();
      console.log('[OpenAI] 요청 전송 완료');
    } catch (writeError) {
      console.error('[OpenAI] 요청 전송 오류:', writeError);
      const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
      reject(new Error(`OpenAI API 요청 전송 실패: ${errorMessage}`));
    }
  });
}

// Gemini API 함수 별칭 export - 기존 코드와의 호환성을 위해
export const callGemini3ProPreviewGeneric = callOpenAIGPT5Generic;