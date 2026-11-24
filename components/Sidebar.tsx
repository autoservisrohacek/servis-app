
import React from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sessions, activeId, onSelect, onNewChat }) => {
  return (
    <aside className="w-72 bg-slate-900 flex flex-col border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          G
        </div>
        <h1 className="text-slate-100 font-semibold text-lg tracking-tight">Gemini Work</h1>
      </div>

      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border border-slate-700 shadow-sm group"
        >
          <i className="fa-solid fa-plus text-sm group-hover:rotate-90 transition-transform"></i>
          <span className="text-sm font-medium">New Conversation</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors group flex items-center gap-3 ${
              activeId === session.id 
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <i className={`fa-regular fa-message text-xs ${activeId === session.id ? 'text-blue-400' : 'text-slate-500'}`}></i>
            <span className="truncate text-sm font-medium">{session.title}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
            <img src="https://picsum.photos/32/32" alt="Avatar" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">Senior Engineer</p>
            <p className="text-xs text-slate-500 truncate">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
