import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { database } from '../lib/firebase';
import { ref, get } from 'firebase/database';

export default function ProfileModal({ user, onClose, onLogout, onJoinRoom }) {
  const [savedProjects, setSavedProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSaved = async () => {
      const safeEmail = user.email.replace(/\./g, '_');
      const snap = await get(ref(database, `SYNCTEXT/users/${safeEmail}/savedProjects`));
      if (snap.exists()) {
        const projects = Object.values(snap.val()).sort((a, b) => b.savedAt - a.savedAt);
        setSavedProjects(projects);
      }
      setLoading(false);
    };
    fetchSaved();
  }, [user.uid]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 sm:border border-black/10 dark:border-white/10 sm:rounded-2xl p-5 flex flex-col gap-4 shadow-2xl w-full h-full sm:h-auto sm:max-w-[360px] sm:max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center">
          <h3 className="text-[12px] font-black uppercase tracking-widest dark:text-white">My Profile</h3>
          <button onClick={onClose} className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all">
            <X className="w-3.5 h-3.5 text-black dark:text-white" />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-xl border border-black/5 dark:border-white/5">
          <img src={user.photoURL} className="w-10 h-10 rounded-lg grayscale border border-black/10 dark:border-white/10" alt="avatar" />
          <div className="flex flex-col">
            <span className="text-[12px] font-black uppercase tracking-tight dark:text-white">{user.displayName}</span>
            <span className="text-[9px] opacity-40 font-medium dark:text-white/50">{user.email}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30 dark:text-white/40">My Saved Projects</span>
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[40vh] pr-1 no-scrollbar">
            {loading ? (
              <div className="text-[9px] opacity-40 italic py-4 text-center dark:text-white/40 uppercase tracking-widest">Loading Projects...</div>
            ) : savedProjects.length > 0 ? (
              savedProjects.map(p => (
                <div key={p.id} onClick={() => onJoinRoom(p.id)} className="flex items-center justify-between bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-2.5 rounded-xl hover:bg-black dark:hover:bg-white hover:border-black dark:hover:border-white group transition-all cursor-pointer">
                  <div className="flex flex-col gap-0.5 max-w-[85%]">
                    <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white group-hover:text-white dark:group-hover:text-black truncate transition-colors">{p.title || p.id}</span>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[7px] opacity-30 font-bold uppercase group-hover:opacity-60 transition-opacity dark:text-white">ID: {p.id}</span>
                            <span className="text-[7px] opacity-10 dark:text-white/10 group-hover:opacity-20">•</span>
                            <span className="text-[7px] opacity-30 font-bold uppercase group-hover:opacity-60 transition-opacity dark:text-white">{new Date(p.savedAt).toLocaleDateString()}</span>
                        </div>
                        {(p.originalOwner || p.originalOwnerEmail) && (
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[6px] font-black uppercase bg-black/5 dark:bg-white/10 text-black dark:text-white px-1 py-0.5 rounded tracking-tighter group-hover:bg-white/20 group-hover:text-white dark:group-hover:text-black transition-all">From</span>
                                <span className="text-[6px] font-bold opacity-30 uppercase tracking-tight group-hover:opacity-60 transition-opacity dark:text-white">{p.originalOwner || 'Admin'} {p.originalOwnerEmail ? `• ${p.originalOwnerEmail}` : ''}</span>
                            </div>
                        )}
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-20 group-hover:opacity-100 transition-all group-hover:text-white dark:group-hover:text-black" />
                </div>
              ))
            ) : (
              <div className="text-[9px] opacity-30 italic py-6 text-center dark:text-white/30 border border-dashed border-black/10 dark:border-white/10 rounded-xl uppercase tracking-widest">No Projects Found</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button onClick={onLogout} className="w-full h-9 bg-black/5 dark:bg-white/5 text-black dark:text-white border border-black/5 dark:border-white/5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">Logout Account</button>
          <button onClick={onClose} className="w-full h-9 bg-black dark:bg-white text-white dark:text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all">Close Dashboard</button>
        </div>
      </div>
    </div>
  );
}
