import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global Request Logger
  app.use((req, res, next) => {
    console.log(`[v2.4-SRV] ${new Date().toISOString()} | ${req.method} ${req.url}`);
    next();
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(">>> ERROR: GEMINI_API_KEY is NOT set in environment!");
  } else {
    console.log(">>> GEMINI_API_KEY detected.");
  }

  app.use(express.json());

  // Public Ping for Diagnostics
  app.get("/ping", (req, res) => {
    res.send(`Niswah Server v2.4 [${new Date().toISOString()}]`);
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      version: "v2.4",
      hasKey: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV
    });
  });

  // API Gateway for Gemini (v2.4)
  app.post("/niswah-gateway", async (req, res) => {
    console.log(">>> niswah-gateway: AI request received");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Missing API Key" });
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = (genAI as any).getGenerativeModel({
        model: requestedModel || "gemini-1.5-flash",
        systemInstruction: systemPrompt,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      });

      const result = await model.generateContent({
        contents: [
          ...(messages || []),
          { role: "user", parts: [{ text: text || "" }] }
        ]
      });

      if (!result.response) {
        throw new Error("Gemini returned empty response");
      }

      const responseText = result.response.text();
      res.json({ text: responseText });
    } catch (error: any) {
      console.error(">>> Gateway Fail:", error);
      res.status(500).json({ 
        error: String(error.message || "Unknown error in gateway"),
        code: "GATEWAY_FAIL"
      });
    }
  });

  // Serve static files check
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(distPath);

  if (process.env.NODE_ENV === "production" || hasDist) {
    console.log(">>> Mode: PRODUCTION (Serving dist)");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log(">>> Mode: DEVELOPMENT (Starting Vite)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Niswah Server v2.4 live on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("!!! GLOBAL BOOT ERROR:", err);
  process.exit(1);
});
