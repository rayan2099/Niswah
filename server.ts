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

  // 1. Diagnostics (before parsers)
  app.get("/niswah-gateway", (req, res) => {
    res.send(`Niswah Gateway Test v2.5 - Status: Active [${new Date().toISOString()}]`);
  });

  app.get("/ping", (req, res) => {
    res.send(`Pong v2.5 - Server is running`);
  });

  // 2. Parsers
  app.use(express.json());

  // 3. Request Logger
  app.use((req, res, next) => {
    console.log(`[v2.5-SRV] ${req.method} ${req.url}`);
    next();
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(">>> [v2.5] ERROR: GEMINI_API_KEY IS MISSING!");
  }

  // 4. AI Gateway
  app.post("/niswah-gateway", async (req, res) => {
    console.log(">>> [v2.5] POST /niswah-gateway hit");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Missing API Key on Server" });
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
        throw new Error("No response from AI engine");
      }

      const responseText = result.response.text();
      res.json({ text: responseText });
    } catch (error: any) {
      console.error(">>> [v2.5] Gateway Error:", error);
      res.status(500).json({ 
        error: String(error.message || "Internal AI Gateway Error"),
        code: "V2_5_GATEWAY_FAIL"
      });
    }
  });

  // 5. App Routes & Static Serving
  const distPath = path.join(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  if (isProd) {
    console.log(">>> [v2.5] Serving Production Assets");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log(">>> [v2.5] Starting Development Proxy (Vite)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [v2.5] NISWAH_GATEWAY ready on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error(">>> [v2.5] FATAL STARTUP ERROR:", err);
  process.exit(1);
});
