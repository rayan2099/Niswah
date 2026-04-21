import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request logger middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is not defined!");
  } else {
    console.log("GEMINI_API_KEY is detected.");
  }

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      hasKey: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV || "not set",
      version: "v2.1-Server"
    });
  });

  // API Route for Gemini (v2.3)
  app.post("/gen-ai-proxy", async (req, res) => {
    console.log(">>> gen-ai-proxy hit");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("Server Error: No GEMINI_API_KEY");
        return res.status(500).json({ error: "No API Key" });
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
        throw new Error("Empty response from Gemini");
      }

      const responseText = result.response.text();
      console.log(">>> AI success");
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      res.status(500).json({ 
        error: String(error.message || "Internal Proxy Fail"),
        code: "AI_PROXY_ERROR"
      });
    }
  });

  // Serve static files check dist
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = await (async () => {
    try {
      await path.join(distPath, "index.html");
      return true;
    } catch {
      return false;
    }
  })();

  if (process.env.NODE_ENV === "production" || hasDist) {
    console.log(">>> Serving from DIST folder");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log(">>> Starting VITE dev middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Niswah Server v2.3 listening on 0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("GLOBAL SERVER CRASH:", err);
  process.exit(1);
});
