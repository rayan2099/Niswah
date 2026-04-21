import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Diagnostic endpoints (Highest Priority)
  app.get("/niswah-gateway", (req, res) => {
    res.send(`Niswah Gateway Test v2.6 - Status: Operational [${new Date().toISOString()}]`);
  });

  app.get("/ping", (req, res) => {
    res.send(`Pong v2.6 - Express Server is Alive and Healthy`);
  });

  // 2. Middlewares
  app.use(express.json());

  // 3. Logger
  app.use((req, res, next) => {
    console.log(`[v2.6-SRV] ${req.method} ${req.url}`);
    next();
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(">>> [v2.6] CRITICAL: GEMINI_API_KEY IS NOT SET!");
  } else {
    console.log(">>> [v2.6] GEMINI_API_KEY LOADED");
  }

  // 4. AI Gateway
  app.post("/niswah-gateway", async (req, res) => {
    console.log(">>> [v2.6] AI Gateway Activity");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const key = process.env.GEMINI_API_KEY;

      if (!key) {
        return res.status(500).json({ error: "No API Key on Server" });
      }

      const genAI = new GoogleGenAI({ apiKey: key });
      // We use numeric values derived from the HarmCategory/HarmBlockThreshold 
      // internal mappings to avoid crashes with native TS type stripping in Node.
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

      if (!result.response) {
        throw new Error("Empty AI Response");
      }

      const responseText = result.response.text();
      res.json({ text: responseText });
    } catch (error: any) {
      console.error(">>> [v2.6] AI Request Fail:", error);
      res.status(500).json({ 
        error: String(error.message || "Unknown error"),
        code: "GATEWAY_ERROR_V2_6"
      });
    }
  });

  // 5. Static Files & Falling back to Vite
  const distPath = path.join(process.cwd(), "dist");
  const isProd = fs.existsSync(distPath);

  if (isProd) {
    console.log(">>> [v2.6] PRODUCTION MODE: Serving built assets");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log(">>> [v2.6] DEVELOPMENT MODE: Initializing Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [v2.6] SERVER READY ON PORT ${PORT}`);
  });
}

startServer().catch(err => {
  console.error(">>> [v2.6] FATAL FAILURE:", err);
  process.exit(1);
});
