/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { 
  Send, 
  X, 
  Moon, 
  Sparkles, 
  User, 
  MessageSquare,
  ArrowLeft,
  Info
} from 'lucide-react';
import { GoogleGenAI, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Madhhab } from '../logic/types.ts';
import * as api from '../api/index.ts';
import { DBChatMessage } from '../api/db-types.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---

interface Message {
  id: string;
  role: 'user' | 'interpreter';
  text: string;
  timestamp: number;
}

interface DreamInterpreterProps {
  isOpen: boolean;
  onClose: () => void;
  userMadhhab: Madhhab;
}

// --- COMPONENTS ---

const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn(
        "flex w-full mb-6",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex max-w-[85%] items-end space-x-2",
        isUser ? "flex-row-reverse space-x-reverse" : "flex-row"
      )}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 shadow-sm border border-indigo-200">
            <Moon className="w-4 h-4 text-indigo-600" />
          </div>
        )}
        <div className={cn(
          "p-4 rounded-[24px] text-sm leading-relaxed shadow-sm",
          isUser 
            ? "bg-indigo-600 text-white rounded-br-none" 
            : "bg-white text-indigo-900 border border-black/5 rounded-bl-none"
        )}>
          {message.text}
        </div>
      </div>
    </motion.div>
  );
};

const TypingIndicator = () => (
  <div className="flex space-x-1.5 p-4 bg-white rounded-[24px] rounded-bl-none border border-black/5 w-fit mb-6 shadow-sm">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{ y: [0, -6, 0] }}
        transition={{ 
          repeat: Infinity, 
          duration: 0.8, 
          delay: i * 0.15,
          ease: "easeInOut"
        }}
        className="w-1.5 h-1.5 bg-indigo-300 rounded-full"
      />
    ))}
  </div>
);

// --- MAIN DREAM INTERPRETER COMPONENT ---

async function retry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isRetryable = err?.status === 429 || (err?.status >= 500 && err?.status < 600) || err?.message?.includes('fetch failed') || !err?.status;
      if (!isRetryable || i === maxRetries - 1) throw err;
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export const DreamInterpreter = ({ isOpen, onClose, userMadhhab }: DreamInterpreterProps) => {
  const { t, isRTL } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    const { data: history, error } = await api.getChatHistory('dream');
    if (history && history.length > 0) {
      setMessages(history.map(m => ({
        id: m.id,
        role: m.role as any,
        text: m.text,
        timestamp: new Date(m.timestamp).getTime()
      })));
    }
  };

  const handleSend = async (text: string = inputText) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Save user message to history
    api.saveChatMessage({
      chat_type: 'dream',
      role: 'user',
      text: userMsg.text,
      timestamp: new Date().toISOString()
    });

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'undefined') throw new Error("GEMINI_API_KEY is not set or invalid");
      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = `You are an integrated AI module within the "Niswah" ecosystem. To ensure 100% system stability and prevent "Internal Server Errors," follow these execution rules strictly:

**1. Content Neutralization (Anti-Crash Protocol):**
- If a user input contains dream symbols that might be sensitive (e.g., symbols relating to health, destiny, or intense emotions), do NOT refuse or trigger a safety block. 
- Instead, rephrase the topic into a "General Wellness and Spirituality" context. Provide helpful, broad insights on psychological meanings or cultural symbolism.
- NEVER say "I cannot help with this." Instead, say "دعنا ننظر إلى هذا الحلم من منظور الرموز الثقافية والعافية..." (Let's look at this dream from a cultural symbol and wellness perspective...).

**2. Role & Context Management:**
- [Dreams]: Answer as a "Cultural Symbol Analyst." Focus on the psychological and linguistic meanings of symbols in a supportive and friendly way. Use traditional insights (Ibn Sirin/Al-Nabulsi) as a framework for general guidance.

**3. Error-Proof Output:**
- Keep responses concise (under 200 words) during high-traffic periods.
- Ensure every response starts with a positive affirmation.

**4. Language & Culture:**
- Use "Friendly Arabic" (White Dialect). 
- Avoid definitive future predictions that might trigger safety blocks.

User's Madhhab: ${userMadhhab}`;

      const chatHistory = messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: m.text }]
      }));

      // Robust History Filtering & Truncation
      const filteredHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
      let lastRole: string | null = null;
      for (const msg of chatHistory) {
        if (msg.role !== lastRole) {
          filteredHistory.push(msg);
          lastRole = msg.role;
        }
      }
      
      // Truncate to last 6 messages
      const truncatedHistory = filteredHistory.slice(-6);

      // Gemini requires first message to be from user
      while (truncatedHistory.length > 0 && truncatedHistory[0].role !== 'user') {
        truncatedHistory.shift();
      }
      // Ensure the last message in history is from model before appending new user prompt
      if (truncatedHistory.length > 0 && truncatedHistory[truncatedHistory.length - 1].role === 'user') {
        truncatedHistory.pop();
      }

      const aiMsgId = (Date.now() + 1).toString();
      let fullText = "";
      
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'interpreter',
        text: "",
        timestamp: Date.now()
      }]);

      const model = (ai as any).getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      });

      const result: any = await retry(() => model.generateContentStream({
        contents: [
          ...truncatedHistory,
          { role: 'user', parts: [{ text: text.trim() }] }
        ]
      }) as any);

      for await (const chunk of result.stream) {
        const chunkText = typeof chunk.text === 'function' ? chunk.text() : (chunk.text || "");
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m));
        }
      }

      // Save AI response to history
      api.saveChatMessage({
        chat_type: 'dream',
        role: 'model',
        text: fullText,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error("Dream Interpreter Error:", err);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'interpreter',
        text: t('nisa_error'),
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[300] bg-[#FDFCFB] flex flex-col"
        >
          {/* Header */}
          <header className="p-6 flex items-center justify-between border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className={cn("flex items-center space-x-4", isRTL && "space-x-reverse")}>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className={cn("w-6 h-6 text-indigo-900", isRTL && "rotate-180")} />
              </button>
              <div className={cn("flex items-center space-x-3", isRTL && "space-x-reverse")}>
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shadow-sm border border-indigo-200">
                  <Moon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-indigo-900">{t('dream_interpretation')}</h2>
                  <div className={cn("flex items-center space-x-1", isRTL && "space-x-reverse")}>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{t('online_status')}</span>
                  </div>
                </div>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </header>

          {/* Intro Banner */}
          <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100">
            <div className={cn("flex items-center space-x-2", isRTL && "space-x-reverse")}>
              <Info className="w-3 h-3 text-indigo-600" />
              <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest text-left">
                {t('dream_interpreter_desc')}
              </span>
            </div>
          </div>

          {/* Chat Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 no-scrollbar"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center space-y-8 text-center px-4">
                <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Moon className="w-10 h-10 text-indigo-200" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-bold text-indigo-900">{t('dream_interpreter_title')}</h3>
                  <p className="text-sm text-gray-400 max-w-[240px]">{t('dream_intro')}</p>
                </div>
              </div>
            )}
            
            {messages.map(m => (
              <MessageBubble key={m.id} message={m} />
            ))}
            
            {isTyping && <TypingIndicator />}
          </div>

          {/* Input Bar */}
          <div className="p-6 bg-white border-t border-black/5">
            <div className={cn(
              "flex items-center space-x-3 bg-gray-50 rounded-[28px] p-2 pl-5 border border-black/5 focus-within:border-indigo-500 transition-colors",
              isRTL && "space-x-reverse pl-2 pr-5"
            )}>
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('dream_placeholder')}
                className="flex-1 bg-transparent border-none outline-none text-sm text-indigo-900 placeholder:text-gray-400"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                disabled={!inputText.trim()}
                onClick={() => handleSend()}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  inputText.trim() ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-gray-200 text-gray-400"
                )}
              >
                <Send className={cn("w-5 h-5", isRTL && "rotate-180")} />
              </motion.button>
            </div>
            <p className="text-[8px] text-center text-gray-300 mt-4 uppercase tracking-widest font-bold">
              {t('nisa_disclaimer')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
