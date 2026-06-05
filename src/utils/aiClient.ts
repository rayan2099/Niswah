type GeminiRole = 'user' | 'model';

export interface GeminiContent {
  role: GeminiRole;
  parts: { text: string }[];
}

export async function callGemini(input: {
  systemInstruction: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the user-facing error generic below.
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'تعذر الاتصال بخدمة الذكاء الاصطناعي.');
  }

  return typeof payload?.text === 'string' ? payload.text : '';
}
