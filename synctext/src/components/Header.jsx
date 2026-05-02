import React from 'react';
import { Moon, Sun } from 'lucide-react';

export default function Header({ stats, user, onShowProfile, onLogin }) {
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="w-full flex justify-center p-2.5 sm:p-3 shrink-0 z-[50]">
      <div className="flex items-center gap-1.5">
        {/* Stats Pill - Tactical Design */}
        <div className="h-9 flex items-center gap-3 bg-white dark:bg-[#0a1124] px-4 rounded-full border border-black/5 dark:border-white/[0.05] shadow-premium">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-[#0a1124] dark:text-white leading-none tracking-tighter">{stats.active}</span>
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-[#0a1124]/40 dark:text-white/30 leading-none">Active</span>
          </div>
          <span className="w-[1px] h-2.5 bg-black/5 dark:bg-white/10"></span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-[#0a1124] dark:text-white leading-none tracking-tighter">{stats.total}</span>
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-[#0a1124]/40 dark:text-white/30 leading-none">Total</span>
          </div>
        </div>
        
        {/* Auth & Theme Pill */}
        <div className="h-9 flex items-center gap-2 bg-white dark:bg-[#0a1124] pl-3 pr-1 rounded-full border border-black/5 dark:border-white/[0.05] shadow-premium">
          <button onClick={toggleTheme} className="flex items-center justify-center text-[#0a1124] dark:text-white hover:opacity-60 transition-all active:scale-90">
            <Sun size={12} className="hidden dark:block" />
            <Moon size={12} className="block dark:hidden" />
          </button>
          
          <div className="w-[1px] h-3 bg-black/5 dark:bg-white/10"></div>
  
          {user ? (
            <button onClick={onShowProfile} className="flex items-center gap-2 pr-2 transition-all hover:opacity-80 active:scale-[0.98]">
              <div className="w-6 h-6 rounded-full border border-black/10 dark:border-white/10 p-0.5">
                <img src={user.photoURL} className="w-full h-full rounded-full object-cover" alt="avatar" />
              </div>
              <span className="text-[8.5px] font-black uppercase tracking-widest text-[#0a1124] dark:text-white max-w-[60px] truncate">{user.displayName.split(' ')[0]}</span>
            </button>
          ) : (
            <button 
              onClick={onLogin} 
              className="h-7 px-4 rounded-full bg-brand text-white text-[9px] font-black uppercase tracking-[0.15em] hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-brand/20"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
