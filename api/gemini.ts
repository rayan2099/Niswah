const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_INPUT_CHARS = 12_000;

function getClientIp(req: any): string {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const current = requestBuckets.get(ip);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  requestBuckets.set(ip, current);
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function getContentsTextLength(contents: any[]): number {
  return contents.reduce((total, item) => {
    const parts = Array.isArray(item?.parts) ? item.parts : [];
    return total + parts.reduce((partTotal: number, part: any) => partTotal + String(part?.text || '').length, 0);
  }, 0);
}

export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service is not configured.' });
  }

  const { systemInstruction, contents, temperature = 0.7, maxOutputTokens = 2048 } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ error: 'Missing message contents.' });
  }
  if (getContentsTextLength(contents) > MAX_INPUT_CHARS) {
    return res.status(413).json({ error: 'Message is too long.' });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const outputTokenLimit = Math.min(Math.max(Number(maxOutputTokens) || 2048, 256), 3072);
    const temperatureValue = Math.min(Math.max(Number(temperature) || 0.7, 0), 1);
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: typeof systemInstruction === 'string' ? systemInstruction.slice(0, 8000) : '',
        temperature: temperatureValue,
        maxOutputTokens: outputTokenLimit,
      },
    });

    const text =
      response.text ||
      response.candidates?.flatMap((candidate: any) => candidate.content?.parts || [])
        .map((part: any) => part.text || '')
        .join('')
        .trim() ||
      '';

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error('Gemini API error:', error?.message || error);
    return res.status(502).json({ error: 'AI service is temporarily unavailable.' });
  }
}
