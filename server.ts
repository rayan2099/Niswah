import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // 1. Core Security & Parsing
  app.use(cors());
  app.use(express.json());
  
  // 2. Global Traffic Debugger (Logs EVERY request)
  app.use((req, res, next) => {
    res.setHeader("X-Niswah-Backend", "v6.0-stable");
    console.log(`[v6.0-TRAFFIC] ${req.method} ${req.url} (Origin: ${req.headers.origin})`);
    next();
  });

  // 3. Guaranteed Health Route
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", version: "v6.0", timestamp: new Date().toISOString() });
  });

  // 4. THE AI GATEWAY (Absolute Priority)
  app.post("/api/chat", async (req, res) => {
    console.log(">>> [v6.0] AI_CHAT_POST_START");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error(">>> [v6.0] ERROR: No GEMINI_API_KEY found in process.env");
        return res.status(500).json({ error: "Server Configuration Error: Key Missing" });
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.getGenerativeModel({
        model: requestedModel || "gemini-1.5-flash",
        systemInstruction: systemPrompt,
      });

      console.log(">>> [v6.0] Calling Gemini API...");
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

      const aiResponse = result.response.text();
      console.log(">>> [v6.0] AI_CHAT_SUCCESS");
      res.json({ text: aiResponse, v: "6.0" });
    } catch (error: any) {
      console.error(">>> [v6.0] AI_CHAT_ERROR:", error);
      res.status(500).json({ 
        error: error.message || "An error occurred while processing your request.",
        code: error.status || 500,
        version: "v6.0-S"
      });
    }
  });

  // 5. Frontend Delivery
  const distPath = path.join(process.cwd(), "dist");
  const isProd = fs.existsSync(distPath);

  if (isProd) {
    console.log(">>> [v6.0] Mode: Production. Serving static files.");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    console.log(">>> [v6.0] Mode: Development. Linking Vite middleware.");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // 6. Explicit 404 handler (If it reaches here, it's NOT the platform's 404)
  app.use((req, res) => {
    console.warn(`>>> [v6.0] 404 UNMATCHED: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "EXPRESS_ROUTE_NOT_FOUND", 
      path: req.url,
      version: "v6.0"
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [v6.0] NISWAH BACKEND STARTED ON PORT ${PORT}`);
  });
}

startServer().catch(err => {
  console.error(">>> [v6.0] FATAL STARTUP ERROR:", err);
  process.exit(1);
});
