import React, { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, User, MessageSquare } from 'lucide-react';
import { database } from '../lib/firebase';
import { ref, onValue, set, push, serverTimestamp, query, limitToLast, onDisconnect, update } from 'firebase/database';

export default function PublicChatScreen({ setScreen, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [presence, setPresence] = useState({});
  const [views, setViews] = useState({});
  const scrollRef = useRef(null);
  const visitorKey = localStorage.getItem('visitorKey');

  useEffect(() => {
    const vKey = localStorage.getItem('visitorKey')?.replace(/[.#$[\]]/g, '_');
    if (!vKey) return;

    const chatRef = query(ref(database, 'SYNCTEXT/publicChat'), limitToLast(100));
    const unsub = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      const sorted = list.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(sorted);
      setLoading(false);
      
      if (sorted.length > 0) {
        const lastMsgId = sorted[sorted.length - 1].id;
        
        // Batch Update Persistent View Registry
        const viewData = {
          name: user?.displayName || 'Anonymous',
          photoURL: user?.photoURL || null,
          timestamp: serverTimestamp()
        };
        
        const updates = {};
        sorted.forEach(m => {
          updates[`SYNCTEXT/publicChatViews/${m.id}/${vKey}`] = viewData;
        });
        
        update(ref(database), updates).catch(err => console.error("Seen Registry Error:", err));

        // Update Live Presence
        const myPresenceRef = ref(database, `SYNCTEXT/presence/publicChat/${vKey}`);
        set(myPresenceRef, {
          uid: user?.uid || 'anon',
          name: user?.displayName || 'Anonymous',
          photoURL: user?.photoURL || null,
          lastReadId: lastMsgId,
          lastSeenAt: serverTimestamp()
        });
        onDisconnect(myPresenceRef).remove();
      }

      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    const presenceRef = ref(database, 'SYNCTEXT/presence/publicChat');
    const unsubPresence = onValue(presenceRef, (snap) => {
      setPresence(snap.val() || {});
    });

    const viewsRef = ref(database, 'SYNCTEXT/publicChatViews');
    const unsubViews = onValue(viewsRef, (snap) => {
      setViews(snap.val() || {});
    });

    return () => {
      unsub();
      unsubPresence();
      unsubViews();
    };
  }, [user]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!user) return alert('Please sign in to join the public chat.');
    if (!newMessage.trim()) return;

    try {
      await push(ref(database, 'SYNCTEXT/publicChat'), {
        text: newMessage.trim(),
        uid: user.uid,
        name: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full h-full sm:h-[540px] sm:max-w-[340px] bg-white dark:bg-[#0a1124] sm:border border-black/10 dark:border-white/[0.05] sm:rounded-[32px] overflow-hidden shadow-premium flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-black/5 dark:border-white/[0.05] flex items-center justify-between bg-white/80 dark:bg-[#0a1124]/80 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('join')} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all active:scale-95">
            <ArrowLeft className="w-3.5 h-3.5 text-[#0a1124] dark:text-white" />
          </button>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.1em] text-[#0a1124] dark:text-white leading-tight">Public Chat</h2>
            <p className="text-[8px] font-black text-brand uppercase tracking-[0.2em]">Global Community</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 custom-scrollbar bg-black/[0.01] dark:bg-black/20">
        <div ref={scrollRef} />
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="spinner block border-[#0a1124]/20 dark:border-white/20" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-20">
            <MessageSquare className="w-6 h-6 mb-3 text-[#0a1124] dark:text-white" />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0a1124] dark:text-white">No logs found</p>
          </div>
        ) : (
          [...messages].reverse().map((m, idx, arr) => {
            const date = new Date(m.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            const prevMsg = arr[idx + 1];
            const nextMsg = arr[idx - 1];
            
            const prevPrevMsg = arr[idx + 2];
            const isSecondInGroup = prevMsg && prevMsg.email === m.email && (!prevPrevMsg || prevPrevMsg.email !== m.email || (prevMsg.timestamp - prevPrevMsg.timestamp > 300000));
            const isSameAsPrev = prevMsg && prevMsg.email === m.email && (m.timestamp - prevMsg.timestamp < 300000) && isSecondInGroup;
            const isSameAsNext = nextMsg && nextMsg.email === m.email && (nextMsg.timestamp - m.timestamp < 300000);
            
            const prevDateStr = prevMsg ? new Date(prevMsg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : null;
            const showDateHeader = dateStr !== prevDateStr;

            return (
              <div key={m.id} className={`flex flex-col ${showDateHeader ? 'mb-6' : 'mb-0'}`}>
                {showDateHeader && (
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-[1px] bg-black/5 dark:bg-white/5"></div>
                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-[#0a1124]/30 dark:text-white/20">{dateStr}</span>
                    <div className="flex-1 h-[1px] bg-black/5 dark:bg-white/5"></div>
                  </div>
                )}
                
                <div className={`flex flex-col ${m.email === user?.email ? 'items-end' : 'items-start'}`}>
                  {!isSameAsPrev && (
                    <div className={`flex items-center gap-2 mb-1.5 ${m.email === user?.email ? 'flex-row-reverse' : ''} mt-4`}>
                        <div className="w-5 h-5 rounded-full overflow-hidden border border-black/5 dark:border-white/10 bg-surface dark:bg-[#0a1124] flex items-center justify-center p-0.5">
                          {m.photoURL ? (
                              <img 
                                  src={m.photoURL} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover rounded-full" 
                                  alt="" 
                              />
                          ) : <User size={10} className="text-[#0a1124]/20 dark:text-white/20" />}
                        </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0a1124]/40 dark:text-white/30">
                        {m.email === user?.email ? 'You' : m.name.split(' ')[0]} • {timeStr}
                      </span>
                    </div>
                  )}
                  
                  <div className={`group relative max-w-[88%] px-4 py-2.5 rounded-2xl text-[12.5px] font-semibold leading-relaxed shadow-sm transition-all break-words ${m.email === user?.email
                      ? `bg-brand text-white ${isSameAsPrev ? 'rounded-tr-md' : 'rounded-tr-none'}`
                      : `bg-white dark:bg-[#0d152b] text-[#0a1124] dark:text-white border border-black/5 dark:border-white/[0.08] ${isSameAsPrev ? 'rounded-tl-md' : 'rounded-tl-none'}`
                    }`}
                  >
                    {m.text}
                  </div>
                  
                  {/* Seen Indicators */}
                  {(!isSameAsNext || idx === 0) && (
                    <div className="flex items-center gap-2 mt-1.5 px-1 min-h-[14px]">
                        {(() => {
                        const msgViews = views[m.id] || {};
                        const othersSeen = Object.entries(msgViews).filter(([key]) => key !== visitorKey);
                        const totalSeen = Object.keys(msgViews).length;
                        
                        if (othersSeen.length > 0) {
                            return (
                            <>
                                <div className="flex -space-x-1.5">
                                {othersSeen.slice(0, 4).map(([key, p]) => (
                                    <div key={key} className="w-3.5 h-3.5 rounded-full overflow-hidden border-2 border-white dark:border-[#0a1124] bg-surface dark:bg-[#0d152b] flex items-center justify-center shadow-sm">
                                    {p.photoURL ? (
                                        <img src={p.photoURL} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <User size={8} className="text-[#0a1124]/40 dark:text-white/40" />
                                    )}
                                    </div>
                                ))}
                                </div>
                                <span className="text-[7.5px] font-black uppercase tracking-[0.15em] text-brand">
                                {totalSeen > 1 ? `${totalSeen} Seen` : '1 Seen'}
                                </span>
                            </>
                            );
                        } else if (m.email === user?.email) {
                            return (
                                <span className="text-[7.5px] font-black uppercase tracking-[0.15em] text-[#0a1124]/20 dark:text-white/20">
                                {totalSeen > 0 ? `${totalSeen} Seen` : 'Delivered'}
                                </span>
                            );
                        }
                        return null;
                        })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-black/5 dark:border-white/[0.05] bg-white dark:bg-[#0a1124] z-20 shadow-2xl">
        {!user ? (
          <div className="text-center py-1 flex flex-col items-center">
            <h3 className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mb-1">Authentication Required</h3>
            <p className="text-[8px] font-bold text-[#0a1124]/40 dark:text-white/30 uppercase tracking-[0.15em]">Sign in to join the conversation</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 h-10 px-4 bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/10 rounded-[14px] text-[11px] font-bold focus:outline-none focus:border-brand dark:text-white placeholder:opacity-20"
            />
            <button type="submit" className="w-10 h-10 bg-brand text-white rounded-[14px] flex items-center justify-center transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-brand/20">
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
