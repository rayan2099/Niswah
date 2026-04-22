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
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Zap,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as api from '../api/index.ts';
import { State, Madhhab } from '../logic/types.ts';
import { DBChatMessage } from '../api/db-types.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---

interface Message {
  id: string;
  role: 'user' | 'niswah';
  text: string;
  timestamp: number;
}

interface NiswahAIProps {
  isOpen: boolean;
  onClose: () => void;
  userContext: {
    madhhab: Madhhab;
    fiqh_state: State;
    cycle_day: number;
    conditions: string[];
    ramadan_active: boolean;
    pregnant: boolean;
  };
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
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 shadow-sm border border-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
        )}
        <div className={cn(
          "p-4 rounded-[24px] text-sm leading-relaxed shadow-sm",
          isUser 
            ? "bg-emerald-600 text-white rounded-br-none" 
            : "bg-white text-emerald-900 border border-black/5 rounded-bl-none"
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
        className="w-1.5 h-1.5 bg-emerald-300 rounded-full"
      />
    ))}
  </div>
);

const QuickPrompt = ({ text, onClick }: { text: string, onClick: () => void }) => (
  <motion.button
    whileTap={{ scale: 0.96 }}
    onClick={onClick}
    className="px-5 py-3 bg-white rounded-2xl border border-black/5 text-[10px] font-bold text-emerald-900 uppercase tracking-widest shadow-sm hover:border-emerald-500 transition-colors"
  >
    {text}
  </motion.button>
);

// --- MAIN NISWAH AI COMPONENT ---

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

export const NiswahAI = ({ isOpen, onClose, userContext }: NiswahAIProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    t('prompt_haid_activities'),
    t('prompt_explain_istihadah'),
    t('prompt_symptom_pattern')
  ];

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
    const { data: history } = await api.getChatHistory('niswah');
    if (history && history.length > 0) {
      setMessages(history.map(m => ({
        id: m.id,
        role: m.role === 'model' ? 'niswah' : 'user',
        text: m.text,
        timestamp: new Date(m.timestamp).getTime()
      })));
    }
  };

  const callAI = async (
    systemPrompt: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const contents = [
        ...history.map(m => ({
          role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
          parts: [{ text: m.content }]
        })),
        { role: 'user' as const, parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      });

      return response.text || '';
    } catch (err: any) {
      console.error("Gemini AI API Error:", err);
      throw new Error(`Gemini AI Error: ${err.message}`);
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

    // Save user message
    api.saveChatMessage({
      chat_type: 'niswah',
      role: 'user',
      text: userMsg.text,
      timestamp: new Date().toISOString()
    });

    const systemPrompt = `أنتِ "نسوة AI" — مساعدة ذكية متخصصة في صحة المرأة المسلمة.
تجمعين بين الفقه الإسلامي والعلم الحديث لتقديم المساعدة.
ردودك باللغة العربية الواضحة. موجزة ومفيدة. لا تتجاوزي 300 كلمة.
للأسئلة الطبية: قدمي معلومات عامة وأحيلي للطبيب.
للأسئلة الفقهية: اذكري الحكم مع المذهب وأحيلي لعالمة دين.
Knowledge: women's health and Islamic Fiqh for women across all four Sunni Madhhabs.
Current user context:
- Madhhab: ${userContext.madhhab}
- Fiqh state: ${userContext.fiqh_state}
- Conditions: ${(userContext.conditions || []).join(', ')}
- Pregnant: ${userContext.pregnant}`;

    try {
      const history = messages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }));

      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'niswah',
        text: "...",
        timestamp: Date.now()
      }]);

      const aiText = await callAI(systemPrompt, text.trim(), history);
      
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: aiText } : m));

      // Save AI response
      api.saveChatMessage({
        chat_type: 'niswah',
        role: 'model',
        text: aiText,
        timestamp: new Date().toISOString()
      });

    } catch (err: any) {
      console.error("Niswah AI Error:", err);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'niswah',
        text: `عذراً، حدث خطأ في الاتصال. (${err.message})`,
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
            <div className="flex items-center space-x-4">
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-emerald-900" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm border border-emerald-200">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-emerald-900">Niswah AI <span className="text-[10px] opacity-30">v2.0-BS</span></h2>
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t('online_status')}</span>
                  </div>
                </div>
              </div>
            </div>
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
          </header>

          {/* Context Banner */}
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100">
            <button 
              onClick={() => setIsContextExpanded(!isContextExpanded)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center space-x-2">
                <Info className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest text-left">
                  {t('nisa_knows')
                    .replace('{{day}}', userContext.cycle_day.toString())
                    .replace('{{madhhab}}', userContext.madhhab)
                    .replace('{{state}}', t(userContext.fiqh_state.toLowerCase() as any))}
                </span>
              </div>
              {isContextExpanded ? <ChevronUp className="w-3 h-3 text-emerald-600" /> : <ChevronDown className="w-3 h-3 text-emerald-600" />}
            </button>
            <AnimatePresence>
              {isContextExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-3 space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <p className="text-[8px] font-bold text-gray-400 uppercase">{t('conditions_label')}</p>
                      <p className="text-[10px] font-bold text-emerald-900">{userContext.conditions.join(', ') || t('none')}</p>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-emerald-100">
                      <p className="text-[8px] font-bold text-gray-400 uppercase">{t('status_label')}</p>
                      <p className="text-[10px] font-bold text-emerald-900">
                        {userContext.pregnant ? t('pregnant_status') : userContext.ramadan_active ? t('ramadan_active_status') : t('normal_cycle_status')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chat Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 no-scrollbar"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center space-y-8 text-center px-4">
                <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-emerald-200" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-bold text-emerald-900">{t('nisa_greeting')}</h3>
                  <p className="text-sm text-gray-400 max-w-[240px]">{t('nisa_intro')}</p>
                </div>
                <div className="flex flex-col space-y-3 w-full max-w-[280px]">
                  {quickPrompts.map(p => (
                    <QuickPrompt key={p} text={p} onClick={() => handleSend(p)} />
                  ))}
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
            <div className="flex items-center space-x-3 bg-gray-50 rounded-[28px] p-2 pl-5 border border-black/5 focus-within:border-emerald-500 transition-colors">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('ask_nisa_placeholder')}
                className="flex-1 bg-transparent border-none outline-none text-sm text-emerald-900 placeholder:text-gray-400"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                disabled={!inputText.trim()}
                onClick={() => handleSend()}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  inputText.trim() ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-gray-200 text-gray-400"
                )}
              >
                <Send className="w-5 h-5" />
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
