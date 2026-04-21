import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Logging & CORS
  app.use(cors());
  app.use(express.json());
  
  app.use((req, res, next) => {
    console.log(`>>> [v8.0-REQ] ${req.method} ${req.url}`);
    next();
  });

  // 2. Health & Ping
  app.get("/api/v8-ping", (req, res) => {
    res.json({ 
      status: "ALIVE", 
      version: "8.0", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  });

  // 3. THE AI GATEWAY (Lazy Loaded)
  app.post("/api/niswah-v8-chat", async (req, res) => {
    console.log(">>> [v8.0] CHAT_START");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error(">>> [v8.0] KEY_MISSING");
        return res.status(500).json({ error: "API_KEY_NOT_CONFIGURED" });
      }

      // Lazy load Gemini to prevent startup crashes
      const GeminiModule = await import("@google/genai") as any;
      const genAI = new GeminiModule.GoogleGenAI({ apiKey });
      const model = genAI.getGenerativeModel({
        model: requestedModel || "gemini-1.5-flash",
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent({
        contents: [
          ...(messages || []),
          { role: "user", parts: [{ text: text || "" }] }
        ],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT" as any, threshold: "BLOCK_NONE" as any },
          { category: "HARM_CATEGORY_HATE_SPEECH" as any, threshold: "BLOCK_NONE" as any },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as any, threshold: "BLOCK_NONE" as any },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as any, threshold: "BLOCK_NONE" as any },
        ],
      });

      const aiText = result.response.text();
      res.json({ text: aiText, v: "8.0" });
      console.log(">>> [v8.0] CHAT_OK");
    } catch (error: any) {
      console.error(">>> [v8.0] CHAT_FAIL:", error);
      res.status(500).json({ 
        error: error.message || "Internal AI Error",
        v: "8.0-ERR"
      });
    }
  });

  // 4. Frontend Delivery
  const distPath = path.join(process.cwd(), "dist");
  const isProd = fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // 5. Final fallback
  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND", path: req.url, v: "8.0" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [v8.0] SERVER RUNNING ON PORT ${PORT}`);
  });
}

startServer();
