/**
 * AgentChatWidget.jsx
 * Full-screen chat overlay for the Café Manager AI assistant (IBM Granite agent).
 */
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, ChevronDown } from 'lucide-react';
import { apiFetch } from '../services/api.js';

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const isError = msg.role === 'error';

  return (
    <div className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
        isUser ? 'bg-[#714B67]' : isError ? 'bg-red-100' : 'bg-gradient-to-br from-[#714B67] to-[#9b6b8a]'
      }`}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className={isError ? 'text-red-500' : 'text-white'} />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
        isUser
          ? 'bg-[#714B67] text-white rounded-br-sm'
          : isError
            ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
            : 'bg-white text-gray-800 border border-[#E9ECEF] rounded-bl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#714B67] to-[#9b6b8a] flex items-center justify-center shrink-0 shadow-sm">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-white border border-[#E9ECEF] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-[#714B67] animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your Café AI assistant powered by IBM Granite.\n\nAsk me anything about your café — sales, tables, kitchen queue, loyalty, or payments. I pull live data to answer you."
};

const SUGGESTIONS = [
  "How were sales today?",
  "Which tables are occupied?",
  "What's in the kitchen queue?",
  "Show top selling items",
  "Show loyalty stats",
  "Recent UPI payments"
];

export default function AgentChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const res = await apiFetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: historyRef.current })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const answer = data.answer || 'Sorry, I could not generate a response.';

      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: userText },
        { role: 'assistant', content: answer }
      ].slice(-20);

      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    historyRef.current = [];
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-[10000] rounded-full shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
          open ? 'bg-gray-700 w-12 h-12' : 'bg-[#714B67] hover:bg-[#57344f] w-14 h-14'
        }`}
        aria-label="Toggle AI Assistant"
      >
        {open
          ? <X size={22} className="text-white" />
          : <MessageCircle size={24} className="text-white" />
        }
        {!open && (
          <span className="absolute inset-0 rounded-full bg-[#714B67] opacity-25 animate-ping" />
        )}
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#f8f9fa]">

          {/* ── Header ── */}
          <div className="flex items-center gap-4 px-6 py-4 bg-[#714B67] shadow-lg shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
              <Bot size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-white tracking-wide uppercase">Café AI Assistant</p>
                <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <Sparkles size={9} />
                  IBM Granite
                </span>
              </div>
              <p className="text-xs text-purple-200 font-semibold">Live data from your POS database</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="text-white/60 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* ── Messages area ── */}
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-16 xl:px-32">
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {loading && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* ── Suggestion chips (shown only on welcome screen) ── */}
          {messages.length === 1 && !loading && (
            <div className="px-4 pb-3 md:px-8 lg:px-16 xl:px-32">
              <div className="max-w-3xl mx-auto">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Try asking</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-[#714B67] border border-[#714B67]/30 hover:bg-[#714B67] hover:text-white transition-all shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Input bar ── */}
          <div className="shrink-0 bg-white border-t border-[#E9ECEF] px-4 py-4 md:px-8 lg:px-16 xl:px-32 shadow-lg">
            <div className="max-w-3xl mx-auto flex items-end gap-3">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-grow
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about sales, tables, kitchen, loyalty…"
                disabled={loading}
                className="flex-1 resize-none border border-[#E9ECEF] rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#714B67] focus:ring-2 focus:ring-[#714B67]/10 transition-all bg-[#f8f9fa] disabled:opacity-50"
                style={{ minHeight: 48, maxHeight: 120 }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="w-12 h-12 rounded-2xl bg-[#714B67] text-white flex items-center justify-center hover:bg-[#57344f] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shrink-0"
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Send size={18} />
                }
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 font-medium mt-2 max-w-3xl mx-auto">
              Powered by IBM Granite · Answers are based on live data from your POS database
            </p>
          </div>

        </div>
      )}
    </>
  );
}
