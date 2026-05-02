import React, { useState } from 'react';
import { Info, MessageSquare, Shield, Save, Lock } from 'lucide-react';
import { database } from '../lib/firebase';
import { ref, set, get } from 'firebase/database';

export default function JoinScreen({ setScreen, setRoomPin, user, onShowProfile, onShowFeedback, onShowPublicChat, onLogin }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [requiredSecurityPin, setRequiredSecurityPin] = useState(null);
  const [securityPinInput, setSecurityPinInput] = useState('');

  const handleJoin = async (e) => {
    if (e) e.preventDefault();
    if (pin.length !== 6) return;
    setLoading(true);
    try {
      const snap = await get(ref(database, `SYNCTEXT/projects/${pin}/meta`));
      if (snap.exists()) {
        const meta = snap.val();
        if (meta.securityPin && meta.securityPin !== '') {
          setRequiredSecurityPin(meta.securityPin);
          setLoading(false);
          return;
        }
        setRoomPin(pin);
        setScreen('editor');
      } else {
        alert('Registry path not found');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const verifySecurity = () => {
    if (securityPinInput === requiredSecurityPin) {
      setRoomPin(pin);
      setScreen('editor');
    } else {
      alert('Authentication Failed: Invalid Security PIN');
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      await set(ref(database, `SYNCTEXT/projects/${newPin}/meta`), {
        createdAt: Date.now(),
        createdBy: user ? user.email.replace(/\./g, '_') : 'anonymous',
        isSaved: false
      });
      setRoomPin(newPin);
      setScreen('editor');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="w-full h-auto max-h-[98vh] mt-1 sm:my-auto sm:max-w-[320px] bg-white dark:bg-[#0a1124] border border-black/10 dark:border-white/[0.05] rounded-[32px] p-4 shadow-premium flex flex-col items-center relative transition-all overflow-y-auto no-scrollbar mx-4 sm:mx-0">
      <div className="w-full flex justify-between items-center mb-5">
        <div className="relative group">
          <button onClick={() => setShowInfo(!showInfo)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-sm">
            <Info className="w-3.5 h-3.5 text-[#0a1124] dark:text-white" />
          </button>
          {showInfo && (
            <div className="absolute top-10 left-0 w-[220px] bg-white dark:bg-[#0d152b] border border-black/10 dark:border-white/10 rounded-2xl p-4 text-left shadow-2xl z-20">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2 dark:text-white">
                <span className="w-1 h-1 rounded-full bg-brand"></span>
                About
              </h3>
              <div className="text-[9px] font-bold text-[#0a1124]/60 dark:text-white/60 space-y-1.5 leading-relaxed">
                <p>Created by: <b className="text-[#0a1124] dark:text-white">Prince Vic</b></p>
                <p>Version: <span className="text-[#0a1124] dark:text-white">1.0.26</span></p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onShowPublicChat} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-sm">
            <svg className="w-3.5 h-3.5 text-[#0a1124] dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          </button>
          <button onClick={onShowFeedback} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-sm">
            <MessageSquare className="w-3.5 h-3.5 text-[#0a1124] dark:text-white" />
          </button>
        </div>
      </div>

      <div className="mb-4 text-center">
        <h1 className="text-[32px] font-black tracking-[-0.04em] text-[#0a1124] dark:text-white leading-tight uppercase mb-0.5">SyncText</h1>
        <div className="flex items-center justify-center gap-2 opacity-20 mb-1.5">
          <div className="h-[1px] w-4 bg-[#0a1124] dark:bg-white"></div>
          <p className="text-[8px] font-black text-[#0a1124] dark:text-white uppercase tracking-[0.25em]">Type • Edit • Sync</p>
          <div className="h-[1px] w-4 bg-[#0a1124] dark:bg-white"></div>
        </div>
        <p className="text-[10px] font-bold text-[#0a1124]/40 dark:text-white/30 leading-relaxed uppercase tracking-wide max-w-[200px] mx-auto">
          Fast, secure, and ephemeral sync.
        </p>
      </div>

      <div className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-[24px] p-4 mb-4 shadow-inner">
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <div className="flex flex-col items-center">
            <label className="text-[8px] uppercase tracking-[0.2em] font-black text-[#0a1124]/30 dark:text-white/20 mb-2">Room PIN</label>
            <input 
              type="text" 
              maxLength="6" 
              placeholder="000000"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full h-11 bg-white dark:bg-[#0a1124] border border-black/[0.08] dark:border-white/10 rounded-xl px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 shadow-inner transition-all text-center text-xl font-black tracking-[0.4em] text-[#0a1124] dark:text-white placeholder:opacity-10"
            />
          </div>
          <button type="submit" className="w-full h-10 bg-[#0a1124] dark:bg-white dark:text-[#0a1124] text-white rounded-[14px] text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg" disabled={loading}>
            <span>Join Room</span>
            {loading && <div className="spinner block border-black/20 dark:border-white/20" />}
          </button>
          <div className="flex items-center gap-3 my-0.5">
            <div className="flex-1 h-[1px] bg-black/5 dark:bg-white/5"></div>
            <span className="text-[8px] uppercase font-black text-[#0a1124]/20 dark:text-white/20 tracking-widest">or</span>
            <div className="flex-1 h-[1px] bg-black/5 dark:bg-white/5"></div>
          </div>
          <button type="button" onClick={handleCreate} className="w-full h-10 bg-brand text-white rounded-[14px] text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-brand/10" disabled={loading}>
            <span>Create New Room</span>
            {loading && <div className="spinner block border-white/20" />}
          </button>
        </form>
      </div>


      <div className="w-full px-1">
        <div className="flex items-center gap-2 mb-1.5 opacity-30 dark:opacity-20">
          <Shield size={10} className="text-[#0a1124] dark:text-white" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#0a1124] dark:text-white">Privacy</span>
        </div>
        <p className="text-[9px] text-[#0a1124]/50 dark:text-white/30 font-semibold leading-relaxed bg-black/[0.03] dark:bg-white/[0.02] p-3 rounded-xl border border-black/[0.05] dark:border-white/[0.05]">
          Rooms are temporary and synced in real-time. Unsaved data is deleted when everyone leaves. Sign in to save projects permanently.
        </p>
      </div>

      {requiredSecurityPin !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-[340px] rounded-[40px] p-8 border border-black/5 dark:border-white/5 shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-brand/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div className="text-center">
                <h2 className="text-[13px] font-black uppercase tracking-widest text-[#0a1124] dark:text-white">Locked Room</h2>
                <p className="text-[9px] font-bold text-brand uppercase tracking-widest mt-1.5 opacity-80">Authentication Required</p>
            </div>
            <input 
                type="password" 
                autoFocus
                placeholder="SECURITY PIN"
                value={securityPinInput}
                onChange={(e) => setSecurityPinInput(e.target.value)}
                className="w-full h-14 bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-2xl px-6 text-center text-xl font-black tracking-[8px] outline-none focus:border-brand/30 transition-all dark:text-white"
            />
            <div className="flex w-full gap-3">
                <button 
                    onClick={() => setRequiredSecurityPin(null)}
                    className="flex-1 h-12 rounded-2xl border border-black/5 dark:border-white/5 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all dark:text-white"
                >
                    Abort
                </button>
                <button 
                    onClick={verifySecurity}
                    className="flex-[2] h-12 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                >
                    Authorize
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
