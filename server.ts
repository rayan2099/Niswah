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

  // API Route for Gemini
  app.post("/api/ai/chat", async (req, res) => {
    console.log("Handling AI chat request...");
    try {
      const { systemPrompt, messages, text, model: requestedModel } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing on server." });
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
          ...messages,
          { role: "user", parts: [{ text }] }
        ]
      });

      if (!result.response) {
        throw new Error("No response from Gemini API");
      }

      const responseText = result.response.text();
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("Server AI Error Trace:", error);
      const msg = error.message || "Unknown server error";
      res.status(500).json({ 
        error: String(msg),
        details: "v2.1-Server-Execution-Error"
      });
    }
  });

  // Serve static files in production or when dist exists
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    console.log("Starting in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Express server listening on http://0.0.0.0:${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer().catch(err => {
  console.error("GLOBAL SERVER CRASH:", err);
  process.exit(1);
});
