
import React, { useState } from 'react';
import { Wrench, Lock, User, LogIn, AlertCircle } from 'lucide-react';
import { UserSettings } from '../types';

interface LoginProps {
  settings: UserSettings;
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ settings, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === settings.username && password === settings.password) {
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-200 mb-6">
            <Wrench className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            AutoService <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Interní systém servisu</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Uživatelské jméno</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="text" 
                  autoFocus
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Heslo</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="password" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 animate-in shake duration-300">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-xs font-bold text-red-600">Nesprávné přihlašovací údaje!</p>
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 mt-4"
            >
              <LogIn className="w-5 h-5" />
              PŘIHLÁSIT SE
            </button>
          </form>
        </div>

        <p className="text-center mt-10 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} AutoService Pro DB System
        </p>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;
