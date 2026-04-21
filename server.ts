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
  app.all("/api/niswah-v4-gateway", async (req, res) => {
    if (req.method === "GET") {
      return res.json({ status: "Operational", version: "v4.0", type: "Gateway" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log(">>> [v4.0] AI GATEWAY REQUEST");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Server AI Key Missing" });
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

      if (!result.response) throw new Error("No AI content generated");

      res.json({ text: result.response.text(), v: "4.0" });
    } catch (error: any) {
      console.error(">>> [v4.0] AI FAIL:", error);
      res.status(500).json({ 
        error: String(error.message),
        version: "v4.0-Gateway-Error"
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
