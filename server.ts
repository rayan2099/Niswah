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
  const PORT = 3000;

  // 1. Core Config
  app.use(cors());
  app.use(express.json());
  
  // Custom response header to identify our server
  app.use((req, res, next) => {
    res.setHeader("X-Niswah-Version", "v4.0");
    console.log(`[v4.0-SRV] ${req.method} ${req.url}`);
    next();
  });

  // 2. High Priority AI Gateway
  app.all("/niswah-v5-backend", async (req, res) => {
    res.setHeader("X-Niswah-Diagnostic", "v5.0");
    if (req.method === "GET") {
      return res.json({ status: "Operational", version: "v5.0", transport: "Direct" });
    }

    console.log(">>> [v5.0] AI REQUEST RECEIVED");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error(">>> [v5.0] MISSING API KEY");
        return res.status(500).json({ error: "Missing Server API Key", v: "5.0" });
      }

      console.log(">>> [v5.0] Init Gemini SDK");
      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.getGenerativeModel({
        model: requestedModel || "gemini-1.5-flash",
        systemInstruction: systemPrompt,
      });

      console.log(">>> [v5.0] Generating Content...");
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

      const responseText = result.response.text();
      console.log(">>> [v5.0] SUCCESS");
      res.json({ text: responseText, v: "5.0" });
    } catch (error: any) {
      console.error(">>> [v5.0] CRITICAL FAIL:", error);
      res.status(500).json({ 
        error: error.message || "Internal Framework Error",
        version: "v5.0-internal"
      });
    }
  });

  // 3. Static / Development Serving
  const distPath = path.join(process.cwd(), "dist");
  const isProd = fs.existsSync(distPath);

  if (isProd) {
    console.log(">>> [v4.0] Serving static from dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log(">>> [v4.0] Dynamic Vite middleware");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Final 404 Catch (PROVES IT IS OUR EXPRESS SERVER)
  app.use((req, res) => {
    res.status(404).json({ 
      error: "NISWAH_V4_NOT_FOUND", 
      path: req.url,
      timestamp: new Date().toISOString()
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [v4.0] Niswah Server Running on Port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error(">>> [v4.0] BOOT FAILED:", err);
  process.exit(1);
});
