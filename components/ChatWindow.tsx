
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, Role } from '../types';

interface ChatWindowProps {
  session: ChatSession | null;
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ session, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <p>Select a session to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-slate-800 truncate">{session.title}</h2>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded">Gemini 3 Flash</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
      >
        {session.messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 ${msg.role === Role.USER ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white ${
              msg.role === Role.USER ? 'bg-indigo-600' : 'bg-slate-800'
            }`}>
              <i className={`fa-solid ${msg.role === Role.USER ? 'fa-user text-xs' : 'fa-bolt text-xs'}`}></i>
            </div>
            <div className={`max-w-[80%] space-y-2 ${msg.role === Role.USER ? 'items-end' : ''}`}>
              <div className={`p-4 rounded-2xl shadow-sm border ${
                msg.role === Role.USER 
                  ? 'bg-indigo-600 text-white border-indigo-500' 
                  : 'bg-white text-slate-800 border-slate-100'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
              </div>
              
              {/* Grounding Sources */}
              {msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {msg.metadata.sources.map((src, i) => (
                    <a 
                      key={i}
                      href={src.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-link"></i> {src.title}
                    </a>
                  ))}
                </div>
              )}

              <p className={`text-[10px] text-slate-400 px-1 ${msg.role === Role.USER ? 'text-right' : ''}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center text-white animate-pulse">
              <i className="fa-solid fa-bolt text-xs"></i>
            </div>
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <footer className="p-6 bg-white border-t border-slate-100">
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto relative group"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder:text-slate-400"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button 
              type="button" 
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <i className="fa-solid fa-paperclip"></i>
            </button>
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </div>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-3">
          Gemini Workspace can make mistakes. Check important info.
        </p>
      </footer>
    </div>
  );
};

export default ChatWindow;
