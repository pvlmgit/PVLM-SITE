import React, { useState, useEffect } from 'react';
import { X, Star, Trash2, Heart, MessageSquare } from 'lucide-react';
import { database } from '../lib/firebase';
import { ref, onValue, set, get, remove, runTransaction } from 'firebase/database';

export default function FeedbackScreen({ user, setScreen, onLogin }) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const feedbackRef = ref(database, 'SYNCTEXT/feedbackByUser');
    const unsub = onValue(feedbackRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.values(data).sort((a, b) => {
        const isUserA = user && a.email === user.email;
        const isUserB = user && b.email === user.email;
        if (isUserA && !isUserB) return -1;
        if (!isUserA && isUserB) return 1;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
      setFeedbacks(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    if (!user) return alert('Please sign in with Google first to send feedback.');
    if (!message) return alert('Please write some feedback before sending.');
    if (rating < 1 || rating > 5) return alert('Please choose a rating by clicking the stars.');

    const safeEmail = user.email.replace(/\./g, '_');
    const feedbackRef = ref(database, `SYNCTEXT/feedbackByUser/${safeEmail}`);
    const snap = await get(feedbackRef);
    const existing = snap.val() || {};

    await set(feedbackRef, {
      uid: user.uid,
      name: user.displayName || 'Google User',
      email: user.email || '',
      photoURL: user.photoURL || '',
      message,
      rating,
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now(),
      likesCount: existing.likesCount || 0,
      likedBy: existing.likedBy || {},
      reply: existing.reply || null
    });

    setMessage('');
    setRating(0);
    alert('Feedback saved successfully.');
  };

  const handleLike = async (feedbackId) => {
    if (!user) return alert('Please sign in to like feedback.');
    const feedbackRef = ref(database, `SYNCTEXT/feedbackByUser/${feedbackId}`);
    const snap = await get(feedbackRef);
    if (!snap.exists()) return;

    const data = snap.val();
    const likedBy = data.likedBy || {};
    const safeEmail = user.email.replace(/\./g, '_');
    const isLiked = !!likedBy[safeEmail];

    const likeRef = ref(database, `SYNCTEXT/feedbackByUser/${feedbackId}/likedBy/${safeEmail}`);
    const countRef = ref(database, `SYNCTEXT/feedbackByUser/${feedbackId}/likesCount`);

    try {
      if (isLiked) {
        await remove(likeRef);
        await runTransaction(countRef, (count) => (count || 1) - 1);
      } else {
        await set(likeRef, true);
        await runTransaction(countRef, (count) => (count || 0) + 1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (confirm('Delete your feedback and rating?')) {
      const safeEmail = user.email.replace(/\./g, '_');
      await remove(ref(database, `SYNCTEXT/feedbackByUser/${safeEmail}`));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full h-full sm:h-auto sm:max-w-[880px] bg-white dark:bg-[#0a1124] sm:border border-black/10 dark:border-white/[0.05] sm:rounded-[32px] shadow-2xl flex flex-col sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-black/5 dark:border-white/[0.05] flex flex-col gap-3">
          <div className="flex justify-between items-center relative">
            <button onClick={() => setScreen('join')} className="h-9 px-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all active:scale-95 text-[#0a1124] dark:text-white">
              <X size={12} /> Close
            </button>
            <h2 className="text-[15px] sm:text-[18px] font-black tracking-[-0.02em] text-[#0a1124] dark:text-white leading-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">SyncText Community</h2>
            <div className="flex items-center gap-2">
              {!user ? (
                <button onClick={onLogin} className="h-9 px-5 bg-brand text-white rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 shadow-lg shadow-brand/20">Login</button>
              ) : (
                <div className="flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 pl-1.5 pr-3 py-1 rounded-full">
                   <img className="w-6 h-6 rounded-full object-cover border border-black/5" src={user.photoURL} alt="" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-[#0a1124] dark:text-white">{user.displayName.split(' ')[0]}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Feedback List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-black/[0.01] dark:bg-black/20 custom-scrollbar">
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="spinner block border-[#0a1124]/20 dark:border-white/20" />
                </div>
              ) : feedbacks.length > 0 ? feedbacks.map((f) => (
                <div key={f.email} className="bg-white dark:bg-[#0d152b] border border-black/5 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 transition-all hover:border-black/10 dark:hover:border-white/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-black/5 dark:border-white/10 p-0.5">
                        <img src={f.photoURL} className="w-full h-full rounded-full object-cover" alt="" />
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="text-[11px] sm:text-[13px] font-black text-[#0a1124] dark:text-white uppercase tracking-tight flex items-baseline gap-2">
                          {f.name.split(' ')[0]} {f.updatedAt && <span className="text-brand text-[8px] sm:text-[9px]">(Edited)</span>}
                        </div>
                        <div className="text-[8.5px] sm:text-[9.5px] font-black text-[#0a1124]/40 dark:text-white/30 lowercase tracking-tight max-w-[150px] truncate">{f.email}</div>
                        <div className="text-[8px] font-black text-[#0a1124]/20 dark:text-white/20 uppercase tracking-[0.2em] mt-1">{new Date(f.updatedAt || f.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-[10px] sm:text-[11px] text-[#ffc107] font-black tracking-widest leading-none">{'★'.repeat(f.rating || 0)}</div>
                      <button onClick={() => handleLike((f.email || '').replace(/\./g, '_'))} className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full transition-all font-black text-[8px] uppercase active:scale-90 ${f.likedBy?.[user?.email?.replace(/\./g, '_')] ? 'bg-red-500/15 text-red-500 shadow-sm' : 'bg-red-500/[0.03] dark:bg-red-500/10 text-red-500/60 dark:text-red-500/40'}`}>
                        <Heart size={10} className={`${f.likedBy?.[user?.email?.replace(/\./g, '_')] ? 'fill-red-500' : ''}`} />
                        {f.likesCount || 0}
                      </button>
                    </div>
                  </div>
                  <div className="text-[12px] sm:text-[14px] font-semibold leading-relaxed text-[#0a1124]/80 dark:text-white/70 break-words">{f.message}</div>
                  {f.reply && (
                    <div className="bg-black/[0.02] dark:bg-white/[0.02] border-l-2 border-brand p-3 sm:p-4 rounded-r-2xl mt-1 flex flex-col gap-2">
                      <div className="text-[9px] font-black uppercase tracking-[0.15em] text-brand">Admin Intelligence</div>
                      <div className="text-[11px] sm:text-[12.5px] font-semibold leading-relaxed text-[#0a1124]/60 dark:text-white/50">{f.reply.text}</div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                  <MessageSquare size={32} className="mb-4 text-[#0a1124] dark:text-white" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0a1124] dark:text-white">No records identified</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar / Form */}
          <div className="w-full md:w-[340px] p-5 sm:p-6 flex flex-col gap-6 bg-white dark:bg-[#0a1124] overflow-y-auto shrink-0 border-t sm:border-t-0 sm:border-l border-black/5 dark:border-white/[0.05] z-10 shadow-2xl">
            {/* Sentiment Section */}
            <div className="flex flex-col gap-4 pb-6 border-b border-black/5 dark:border-white/[0.05]">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0a1124] dark:text-white">Community Sentiment</span>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: '5★', p: '85%', w: '85%', c: '#ffc107' },
                  { label: '4★', p: '12%', w: '12%', c: '#ffc107cc' },
                  { label: '3★', p: '2%', w: '2%', c: '#ffc10788' },
                  { label: '1★', p: '1%', w: '1%', c: '#ffc10744' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[9px] font-black w-5 text-[#0a1124] dark:text-white">{s.label}</span>
                    <div className="flex-1 h-1.5 bg-black/[0.03] dark:bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: s.w, backgroundColor: s.c }}></div>
                    </div>
                    <span className="text-[9px] font-black text-[#0a1124] dark:text-white opacity-60">{s.p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Write Feedback */}
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0a1124] dark:text-white">Write Feedback</span>
                <p className="text-[11px] font-bold text-[#0a1124]/60 dark:text-white/50">Share your tactical experience with SyncText.</p>
              </div>
 
              <div className="bg-black/[0.01] dark:bg-[#0d152b] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
                <div className="flex justify-center gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRating(n)} className={`text-[26px] cursor-pointer transition-all hover:scale-125 leading-none ${rating >= n ? 'text-[#ffc107]' : 'text-[#0a1124]/10 dark:text-white/10'}`}>★</button>
                  ))}
                </div>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full min-h-[100px] p-4 bg-white dark:bg-[#0a1124] border border-black/[0.08] dark:border-white/10 rounded-2xl font-sans text-[12px] font-semibold leading-relaxed resize-none outline-none transition-all focus:border-brand dark:text-white placeholder:opacity-20 shadow-inner"
                  placeholder="What's on your mind?"
                />
                <div className="flex flex-col gap-3 items-center">
                  <button onClick={handleSubmit} className="w-full h-11 bg-[#0a1124] dark:bg-white text-white dark:text-[#0a1124] rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all active:scale-[0.98] shadow-lg">
                    {feedbacks.some(f => f.email.replace(/\./g, '_') === user?.email.replace(/\./g, '_')) ? 'Update Protocol' : 'Submit Feedback'}
                  </button>
                  {user && feedbacks.some(f => f.email.replace(/\./g, '_') === user.email.replace(/\./g, '_')) && (
                    <button onClick={handleDelete} className="bg-red-500/10 text-red-500 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all hover:bg-red-500/20 active:scale-95">Erase My Log</button>
                  )}
                </div>
                {!user && <div className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-[#0a1124]/20 dark:text-white/20">Authorization Required</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
