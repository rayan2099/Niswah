import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Critical Diagnostics
  app.get("/niswah-gateway", (req, res) => {
    res.json({ 
      status: "Operational", 
      version: "v3.0", 
      time: new Date().toISOString(),
      mode: fs.existsSync(path.join(process.cwd(), "dist")) ? "production" : "development"
    });
  });

  // 2. Middlewares
  app.use(express.json());
  
  app.use((req, res, next) => {
    console.log(`[v3.0-SRV] ${req.method} ${req.url}`);
    next();
  });

  // 3. AI Gateway
  app.post("/niswah-gateway", async (req, res) => {
    console.log(">>> [v3.0] AI GATEWAY POST RECEIVED");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing on server" });
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = (genAI as any).getGenerativeModel({
        model: requestedModel || "gemini-1.5-flash",
        systemInstruction: systemPrompt,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      });

      const result = await model.generateContent({
        contents: [
          ...(messages || []),
          { role: "user", parts: [{ text: text || "" }] }
        ]
      });

      if (!result.response) throw new Error("AI provider returned no response");

      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error(">>> [v3.0] AI Gateway Fail:", error);
      res.status(500).json({ 
        error: String(error.message),
        version: "v3.0"
      });
    }
  });

  // 4. Static / Dev Middleware
  const distPath = path.join(process.cwd(), "dist");
  const isProd = fs.existsSync(distPath);

  if (isProd) {
    console.log(">>> [v3.0] MODE: PRODUCTION (Serving dist)");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log(">>> [v3.0] MODE: DEVELOPMENT (Dynamic Vite Import)");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Fallback 404 to prove Express is alive
  app.use((req, res) => {
    res.status(404).json({ error: "Route not found in Express v3.0", path: req.url });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [v3.0] Niswah Express listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error(">>> [v3.0] CRITICAL BOOT ERROR:", err);
  process.exit(1);
});
