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
  const PORT = 3000; // FAST REQUIREMENT

  // 1. Core Security & Parsing
  app.use(cors());
  app.use(express.json());
  
  // 2. Heavy Logging
  app.use((req, res, next) => {
    console.log(`[V7.0-TRACE] ${req.method} ${req.url}`);
    next();
  });

  // 3. THE FINAL GATEWAY
  app.all("/api/niswah-v7-final", async (req, res) => {
    if (req.method === "GET") {
      return res.json({ status: "ALIVE", v: "7.0" });
    }

    console.log(">>> [v7.0] AI_CALL_START");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) throw new Error("KEY_MISSING");

      const genAI = new GoogleGenAI({ apiKey });
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

      res.json({ text: result.response.text(), v: "7.0" });
      console.log(">>> [v7.0] AI_CALL_OK");
    } catch (error: any) {
      console.error(">>> [v7.0] AI_CALL_ERR:", error);
      res.status(500).json({ error: error.message, v: "7.0-ERR" });
    }
  });

  // 4. Fallback Health
  app.get("/api/health", (req, res) => res.json({ ok: true, version: "7.0" }));

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
