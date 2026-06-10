export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service is not configured.' });
  }

  const { systemInstruction, contents, temperature = 0.7, maxOutputTokens = 2048 } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ error: 'Missing message contents.' });
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: typeof systemInstruction === 'string' ? systemInstruction.slice(0, 8000) : '',
        temperature: Number(temperature) || 0.7,
        maxOutputTokens: Number(maxOutputTokens) || 2048,
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
