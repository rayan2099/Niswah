require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/api/gemini', async (req, res) => {
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
      model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: typeof systemInstruction === 'string' ? systemInstruction.slice(0, 8000) : '',
        temperature: Number(temperature) || 0.7,
        maxOutputTokens: Number(maxOutputTokens) || 2048,
      },
    });

    res.json({ text: response.text || '' });
  } catch (error) {
    console.error('Gemini API error:', error && error.message ? error.message : error);
    res.status(502).json({ error: 'AI service is temporarily unavailable.' });
  }
});

app.use(express.static(DIST_DIR, {
  index: false,
  maxAge: '1y',
  immutable: true,
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Niswah server listening on ${HOST}:${PORT}`);
});
