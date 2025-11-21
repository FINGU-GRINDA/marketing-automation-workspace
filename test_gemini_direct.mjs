// Direct Gemini API test
import https from 'https';

const MODEL = "gemini-2.5-flash";
const API_KEY = "AIzaSyCcytD460IF-6esaaydJ2B6DG30j7tL3jk";

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const requestBody = JSON.stringify({
  contents: [
    {
      parts: [
        { text: "Hello, please respond with a simple greeting." }
      ]
    }
  ],
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 2048
  }
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  port: 443,
  path: `/v1beta/models/${MODEL}:generateContent`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': API_KEY,
    'Content-Length': Buffer.byteLength(requestBody)
  },
  timeout: 60000
};

console.log("[Gemini ERROR TEST] Starting direct API test...");
console.log("[Gemini ERROR TEST] URL:", url);
console.log("[Gemini ERROR TEST] Request body size:", Buffer.byteLength(requestBody), 'bytes');

const req = https.request(options, (res) => {
  let responseData = '';

  console.log("[Gemini ERROR TEST]", res.status, res.statusCode);

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(responseData);
      console.log("[Gemini ERROR TEST]", res.status, JSON.stringify(json, null, 2));
    } catch (error) {
      console.log("[Gemini ERROR TEST]", res.status, responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('[Gemini ERROR TEST] Request error:', error.message);
});

req.on('timeout', () => {
  console.error('[Gemini ERROR TEST] Request timeout');
  req.destroy();
});

req.write(requestBody);
req.end();

console.log("[Gemini ERROR TEST] Request sent");