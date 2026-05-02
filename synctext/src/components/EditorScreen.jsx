import React, { useState, useEffect, useRef } from 'react';
import { Home, Copy, Clipboard, QrCode, Plus, LogOut, Save, Sun, Moon, Eye, EyeOff, X, Check, ChevronUp, Users, Info, Menu, MessageSquare, Shield, Activity, Cpu, RefreshCw, LogIn, Lock, Unlock, FileText, Pin, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { database } from '../lib/firebase';
import { ref, onValue, set, get, onDisconnect } from 'firebase/database';
import { QRCodeSVG } from 'qrcode.react';

const highlightCode = (code) => {
  if (!code) return { html: '', bypassed: false };

  if (code.length > 15000) {
    return {
      html: code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      bypassed: true
    };
  }

  let text = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const regex = /(\/\/.*|\/\*[\s\S]*?\*\/)|(["'`][^"'`]*["'`])|(#(?:[0-9a-fA-F]{3}){1,2}\b)|\b(const|let|var|function|return|if|else|for|while|import|export|default|class|extends|async|await|try|catch|finally|export)\b|(&lt;\/?[a-zA-Z0-9]+(?:\s+[^&]*)?&gt;)|\b(\d+)\b|\b([a-zA-Z_]\w*)(?=\s*\()/g;

  const result = text.replace(regex, (m, comment, string, hex, keyword, tag, number, func) => {
    if (comment) return `<span style="color: #5c6370; font-style: italic">${m}</span>`;
    if (string) return `<span style="color: #98c379">${m}</span>`;
    if (hex) return `<span style="color: #d19a66">${m}</span>`;
    if (keyword) return `<span style="color: #c678dd">${m}</span>`;
    if (tag) return `<span style="color: #e06c75">${m}</span>`;
    if (number) return `<span style="color: #d19a66">${m}</span>`;
    if (func) return `<span style="color: #61afef">${m}</span>`;
    return m;
  });

  return { html: result, bypassed: false };
};

export default function EditorScreen({ roomPin, setScreen, user, onShowProfile, onLogin, onShowPublicChat, onShowFeedback }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tabs, setTabs] = useState([{ id: Date.now().toString(), title: 'Tab', type: 'text', content: '' }]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [userList, setUserList] = useState({});
  const [userCount, setUserCount] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isCodeVisible, setIsCodeVisible] = useState(true);
  const [activeLine, setActiveLine] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSidebarLocked, setIsSidebarLocked] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const currentTab = tabs[activeTabIndex] || tabs[0] || { id: '0', title: 'Untitled', type: 'text', content: '' };

  const highlightedContent = React.useMemo(() => {
    return highlightCode(currentTab.content);
  }, [currentTab.content, currentTab.type]);

  const isSyncingRef = useRef(false);
  const editorRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const syntaxRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (!roomPin) return;

    let identity = user ? (user.displayName || user.email) : sessionStorage.getItem('synctext_anon_id');
    if (!identity && !user) {
      identity = 'Anonymous_' + Math.random().toString(36).substr(2, 5);
      sessionStorage.setItem('synctext_anon_id', identity);
    }

    const userKey = user ? user.uid : identity.replace(/\./g, '_');
    const userRef = ref(database, `SYNCTEXT/projects/${roomPin}/users/${userKey}`);

    set(userRef, {
      joinedAt: Date.now(),
      name: identity,
      photoURL: user?.photoURL || null,
      email: user?.email || null,
      uid: user?.uid || null
    });
    onDisconnect(userRef).remove();

    const usersRef = ref(database, `SYNCTEXT/projects/${roomPin}/users`);
    const unsubUsers = onValue(usersRef, (snap) => {
      const data = snap.val() || {};
      setUserList(data);
      setUserCount(Object.keys(data).length);
    });

    const tabsRef = ref(database, `SYNCTEXT/projects/${roomPin}/tabs`);
    const unsubTabs = onValue(tabsRef, (snap) => {
      if (isSyncingRef.current) return;
      const remote = snap.val();
      if (remote) {
        const normalized = Array.isArray(remote) ? remote : Object.values(remote);
        if (normalized.length > 0) {
          setTabs(normalized);
        }
      } else {
        set(tabsRef, tabs);
      }
    });

    return () => {
      set(userRef, null);
      unsubUsers();
      unsubTabs();
    };
  }, [roomPin]);

  const syncTabs = (newTabs) => {
    isSyncingRef.current = true;
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
    set(ref(database, `SYNCTEXT/projects/${roomPin}/tabs`), newTabs);
    setTimeout(() => { isSyncingRef.current = false; }, 100);
  };

  const handleTextChange = (e) => {
    const newTabs = [...tabs];
    newTabs[activeTabIndex].content = e.target.value;
    setTabs(newTabs);
    syncTabs(newTabs);
    updateActiveLine(e);
  };

  const updateActiveLine = (e) => {
    const pos = e.target.selectionStart;
    const textBefore = e.target.value.substring(0, pos);
    const lines = textBefore.split('\n').length - 1;
    setActiveLine(lines);
  };

  const handleCopy = () => {
    const text = currentTab.content;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // Fallback for non-HTTPS or incompatible mobile browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const newTabs = [...tabs];
      newTabs[activeTabIndex].content = text;
      setTabs(newTabs);
      syncTabs(newTabs);
    } catch (e) {
      alert("Clipboard access denied. Please use Ctrl+V to paste manually into the editor.");
    }
  };

  const addTab = () => {
    const newTab = { id: Date.now().toString(), title: 'Tab', type: 'text', content: '' };
    const newTabs = [...tabs, newTab];
    setTabs(newTabs);
    setActiveTabIndex(newTabs.length - 1);
    syncTabs(newTabs);
  };

  const deleteTab = (idx) => {
    if (tabs.length <= 1) return;
    if (!window.confirm('Are you sure you want to delete this tab?')) return;
    const newTabs = tabs.filter((_, i) => i !== idx);
    setTabs(newTabs);
    if (activeTabIndex >= newTabs.length) setActiveTabIndex(newTabs.length - 1);
    syncTabs(newTabs);
  };

  const toggleTabType = () => {
    const newTabs = [...tabs];
    const newType = newTabs[activeTabIndex].type === 'code' ? 'text' : 'code';
    newTabs[activeTabIndex].type = newType;
    if (newType === 'code' && !document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.add('dark');
    }
    setTabs(newTabs);
    syncTabs(newTabs);
  };

  const handleSaveOnline = async () => {
    if (!user) return alert('Please sign in to save online.');
    const safeEmail = user.email.replace(/\./g, '_');
    await set(ref(database, `SYNCTEXT/projects/${roomPin}/meta/isSaved`), true);
    await set(ref(database, `SYNCTEXT/users/${safeEmail}/savedProjects/${roomPin}`), { id: roomPin, savedAt: Date.now() });
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 2000);
  };

  const handleLeave = async () => {
    try {
      const metaSnap = await get(ref(database, `SYNCTEXT/projects/${roomPin}/meta`));
      const meta = metaSnap.val();
      if (meta && !meta.isSaved && userCount <= 1) {
        await set(ref(database, `SYNCTEXT/projects/${roomPin}`), null);
      }
    } catch (e) { console.error(e); }
    setScreen('join');
  };

  return (
    <div
      className="w-full h-full sm:h-[604.8px] sm:max-w-[1280px] bg-white dark:bg-[#0a1124] sm:border border-black/10 dark:border-white/[0.05] sm:rounded-[40px] flex flex-col sm:max-h-[88vh] overflow-hidden animate-fadeIn relative shadow-2xl"
    >
      {/* Main Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-black/5 dark:border-white/[0.05] flex items-center justify-between overflow-x-auto no-scrollbar shrink-0 bg-white/80 dark:bg-[#0a1124]/80 backdrop-blur-xl z-[40]">
        <div className="flex items-center gap-3 min-w-max">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="sm:hidden w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center text-[#0a1124] dark:text-white active:scale-95 transition-all"
          >
            <Menu size={16} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[18px] sm:text-[22px] font-black tracking-[-0.03em] text-black dark:text-white leading-none uppercase">SyncText</h1>
            <span className="text-[7px] font-semibold tracking-[0.4em] text-gray-400 dark:text-gray-500 uppercase mt-1 leading-none">Realtime</span>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          {/* System Action Pill */}
          <div className="h-9 bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 px-3 rounded-full items-center gap-3 hidden sm:flex">
            <button onClick={toggleTheme} className="flex items-center gap-1.5 hover:text-brand transition-all group">
              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-black dark:text-white group-hover:text-brand">
                <Sun size={10} className="hidden dark:block" />
                <Moon size={10} className="block dark:hidden" />
              </div>
              <span className="text-[8px] font-black tracking-[0.1em] text-black dark:text-white uppercase">Mode</span>
            </button>

            <div className="w-[1px] h-3 bg-black/5 dark:bg-white/10"></div>

            <button onClick={() => setShowQR(true)} className="flex items-center gap-1.5 hover:text-brand transition-all group">
              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-black dark:text-white group-hover:text-brand">
                <QrCode size={10} />
              </div>
              <span className="text-[8px] font-black tracking-[0.1em] text-black dark:text-white uppercase">QR</span>
            </button>

            <div className="w-[1px] h-3 bg-black/5 dark:bg-white/10"></div>

            <button onClick={user ? onShowProfile : onLogin} className="flex items-center gap-1.5 group">
              <div className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
                {user ? (
                  user.photoURL ? (
                    <img src={user.photoURL} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full bg-brand text-white flex items-center justify-center text-[9px] font-black uppercase">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-black/5 dark:bg-white/5 text-[#0a1124]/40 dark:text-white/40 flex items-center justify-center group-hover:text-brand transition-colors">
                    <LogIn size={10} />
                  </div>
                )}
              </div>
              <span className="text-[8px] font-black tracking-[0.1em] text-[#0a1124]/40 dark:text-white/30 uppercase group-hover:text-brand transition-all">
                {user ? 'Account' : 'Sign In'}
              </span>
            </button>
          </div>

          {/* Room PIN Pill */}
          <div className="h-9 bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 px-3 rounded-full items-center gap-3 hidden sm:flex transition-all hover:border-brand/20">
            <div className="flex items-center gap-2">
              <Shield size={12} className="text-brand opacity-60" />
              <span className={`text-[10px] font-black tracking-[0.25em] text-[#0a1124] dark:text-white transition-all duration-300 ${isCodeVisible ? 'blur-0' : 'blur-[3.5px] select-none opacity-40'}`}>
                {roomPin}
              </span>
            </div>
            <div className="flex items-center gap-2 border-l border-black/5 dark:border-white/10 pl-3">
              <button onClick={() => setIsCodeVisible(!isCodeVisible)} className="text-[#0a1124]/30 dark:text-white/30 hover:text-brand transition-colors">
                {isCodeVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button onClick={() => navigator.clipboard.writeText(roomPin).then(() => alert('PIN Copied'))} className="text-[#0a1124]/30 dark:text-white/30 hover:text-brand transition-colors">
                <Copy size={13} />
              </button>
            </div>
          </div>

          <div className="h-9 flex items-center gap-3">
            <button onClick={handleSaveOnline} className="h-9 px-4 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[#0a1124] dark:text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-brand hover:text-white hover:border-brand active:scale-95 transition-all flex items-center gap-2 hidden sm:flex">
              <Save size={13} /> <span>Save</span>
            </button>

            <button onClick={handleLeave} className="h-9 px-4 sm:px-5 rounded-full bg-red-500 text-white border border-red-600/10 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all hover:bg-red-600">
              <LogOut size={14} /> <span className="hidden sm:block text-[9px] font-black uppercase tracking-[0.2em]">Leave</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Editor Central Block */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/[0.05] bg-gray-50/50 dark:bg-[#0a1124]/50 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-4 flex-1">
              <input type="text" value={currentTab.title} title={currentTab.title} onChange={(e) => {
                const newTabs = [...tabs];
                newTabs[activeTabIndex].title = e.target.value;
                setTabs(newTabs);
                syncTabs(newTabs);
              }} className="bg-transparent border-none text-[12px] font-semibold uppercase tracking-[0.15em] outline-none w-full max-w-[150px] sm:max-w-[300px] truncate text-[#0a1124] dark:text-white placeholder:opacity-20" placeholder="TAB IDENTIFIER" />
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-4 text-[8px] font-semibold uppercase tracking-[0.2em] border-r border-black/5 dark:border-white/10 pr-6 h-4">
                <span className="text-black dark:text-white">Characters: <span className="text-[#0a1124]/30 dark:text-white/20">{currentTab.content.length}</span></span>
                <span className="text-black dark:text-white">Words: <span className="text-[#0a1124]/30 dark:text-white/20">{currentTab.content.trim().split(/\s+/).filter(w => w).length}</span></span>
                <span className="text-black dark:text-white">Lines: <span className="text-[#0a1124]/30 dark:text-white/20">{currentTab.content.split('\n').length}</span></span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 pr-6 border-r border-black/5 dark:border-white/10">
                <button onClick={handleCopy} className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center transition-all active:scale-90 group" title="Copy Content">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} className="text-[#0a1124]/40 dark:text-white/40 group-hover:text-brand" />}
                </button>
                <button onClick={handlePaste} className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center transition-all active:scale-90 group" title="Paste Content">
                  <Clipboard size={13} className="text-[#0a1124]/40 dark:text-white/40 group-hover:text-brand" />
                </button>
              </div>

              <button onClick={toggleTabType} className={`h-8 px-4 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all shrink-0 flex items-center ${currentTab.type === 'code' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-black/5 dark:bg-white/5 text-[#0a1124] dark:text-white border border-black/10 dark:border-white/10'}`}>
                {currentTab.type === 'code' ? 'Code Mode' : 'Text Mode'}
              </button>
            </div>
          </div>

          <div className={`flex-1 flex overflow-hidden relative transition-colors duration-500 ${currentTab.type === 'code' ? (highlightedContent.bypassed ? 'bg-[#0a1124]' : 'bg-black') : 'bg-white dark:bg-[#0a1124]'}`}>
            <div
              ref={lineNumbersRef}
              className={`w-12 h-full border-r select-none overflow-hidden transition-colors py-6 pointer-events-none no-scrollbar ${currentTab.type === 'code' ? 'bg-black/50 border-white/[0.03]' : 'bg-black/[0.02] dark:bg-black/20 border-black/5 dark:border-white/[0.05]'}`}
            >
              <pre className="editor-font text-right pr-3 text-black dark:text-white font-bold text-[13px] leading-[24px] opacity-50">
                {Array.from({ length: currentTab.content.split('\n').length || 1 }, (_, i) => i + 1).join('\n')}
              </pre>
            </div>

            <div className="flex-1 relative overflow-hidden flex">
              {currentTab.type === 'code' && (
                <div
                  ref={syntaxRef}
                  className="absolute inset-0 p-6 editor-font overflow-hidden z-1 pointer-events-none"
                >
                  <div
                    className="absolute left-0 right-0 h-6 bg-white/5 pointer-events-none transition-all duration-100 z-0"
                    style={{ top: `${(activeLine * 24) + 24}px`, width: '100%' }}
                  />
                  {!highlightedContent.bypassed && (
                    <pre
                      className="editor-font m-0 whitespace-pre text-white pointer-events-none text-[13px] leading-[24px]"
                      dangerouslySetInnerHTML={{ __html: highlightedContent.html + '\n' }}
                    />
                  )}
                </div>
              )}
              <textarea
                ref={editorRef}
                value={currentTab.content}
                onScroll={(e) => {
                  if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = e.target.scrollTop;
                  if (syntaxRef.current) {
                    syntaxRef.current.scrollTop = e.target.scrollTop;
                    syntaxRef.current.scrollLeft = e.target.scrollLeft;
                  }
                  setShowScrollTop(e.target.scrollTop > 300);
                }}
                onClick={updateActiveLine}
                onKeyUp={updateActiveLine}
                onChange={handleTextChange}
                spellCheck="false"
                className={`flex-1 w-full border-none p-6 editor-font resize-none outline-none transition-all z-2 no-scrollbar text-[13px] leading-[24px] ${currentTab.type === 'code' ? (highlightedContent.bypassed ? 'bg-transparent text-white caret-white' : 'bg-transparent text-transparent caret-white') : 'bg-white dark:bg-[#0a1124] text-[#0a1124] dark:text-white placeholder:text-black/20 dark:placeholder:text-white/10 selection:bg-brand/30'}`}
                style={{
                  whiteSpace: currentTab.type === 'code' ? 'pre' : 'pre-wrap',
                  overflowX: currentTab.type === 'code' ? 'auto' : 'hidden'
                }}
                placeholder={currentTab.type === 'code' ? '// Start tactical coding...' : 'Start typing... Your intelligence will be synced in realtime.'}
              />
            </div>
          </div>

          {/* Performance Alerts */}
          <div className={`absolute bottom-6 left-16 flex items-center gap-2 z-30 transition-all duration-300 ${isTyping || (highlightedContent.bypassed && currentTab.type === 'code') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            {isTyping && (
              <div className="bg-black/5 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full px-2 py-0.5 h-6 text-[7.5px] font-black uppercase tracking-[0.25em] text-[#0a1124]/40 dark:text-white/40 flex items-center gap-1.5">
                <RefreshCw size={8} className="animate-spin" />
                <span>Syncing</span>
              </div>
            )}
            {(highlightedContent.bypassed && currentTab.type === 'code') && (
              <div className="bg-black/5 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full px-2 py-0.5 h-6 text-[7.5px] font-black uppercase tracking-[0.25em] text-[#0a1124]/40 dark:text-white/40 flex items-center gap-1.5">
                <Cpu size={8} />
                <span>Perf Mode</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Tabs */}
        <div className={`group/sidebar ${isSidebarLocked ? 'w-[200px]' : 'w-[68px] hover:w-[200px]'} bg-black/[0.02] dark:bg-black/40 border-l border-black/5 dark:border-white/[0.05] flex-col items-center py-5 shrink-0 overflow-y-auto overflow-x-hidden no-scrollbar transition-all duration-500 ease-in-out z-40 hidden sm:flex`}>
          <div className="flex flex-col gap-4 w-full items-center px-3 flex-1">
            <button
              onClick={addTab}
              className="h-10 min-h-[40px] max-h-[40px] rounded-2xl bg-black/5 dark:bg-white/5 border-2 border-dashed border-black/10 dark:border-white/10 text-black/40 dark:text-white/40 flex items-center justify-center hover:bg-brand/10 hover:border-brand/40 hover:text-brand transition-all active:scale-90 group shrink-0 relative w-full"
              title="Add Tactical Tab"
            >
              <span className={`opacity-0 ${isSidebarLocked ? 'opacity-100' : 'group-hover/sidebar:opacity-100'} absolute left-4 whitespace-nowrap text-[9px] font-black uppercase tracking-widest transition-all duration-500`}>New Tab</span>
              <div className={`w-10 h-10 flex items-center justify-center shrink-0 transition-all ${isSidebarLocked ? 'ml-auto' : 'group-hover/sidebar:ml-auto'}`}>
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              </div>
            </button>

            <div className="w-8 h-[1px] bg-black/5 dark:bg-white/5 my-1 transition-all"></div>

            {tabs.map((tab, idx) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabIndex(idx)}
                className={`group/tab relative h-10 min-h-[40px] max-h-[40px] w-full rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${idx === activeTabIndex ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-black/[0.03] dark:bg-white/[0.03] text-[#0a1124]/40 dark:text-white/30 hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                <div className={`flex items-center justify-center w-full h-full px-4 transition-all ${isSidebarLocked ? 'opacity-100' : 'group-hover/sidebar:opacity-100 opacity-0'}`}>
                  <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.15em] truncate w-[110px] min-w-0">
                    {tab.title || "Untitled Tab"}
                  </span>
                  {tabs.length > 1 && idx === activeTabIndex && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTab(idx); }}
                      className="text-white/40 hover:text-white transition-all active:scale-75 shrink-0 ml-auto"
                    >
                      <X size={10} strokeWidth={4} />
                    </button>
                  )}
                </div>

                <div className={`w-10 h-10 absolute flex items-center justify-center shrink-0 z-10 transition-all ${isSidebarLocked ? 'hidden' : 'group-hover/sidebar:hidden'}`}>
                  {tab.type === 'code' ? <Code size={16} strokeWidth={2.5} /> : <FileText size={16} strokeWidth={2.5} />}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Toggle/Lock */}
          <div className="w-full px-3 mt-auto pt-2">
            <button
              onClick={() => setIsSidebarLocked(!isSidebarLocked)}
              className={`group/lock relative h-10 min-h-[40px] max-h-[40px] w-full rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-500 ease-in-out overflow-hidden shrink-0 ${isSidebarLocked ? 'bg-brand/10 text-brand' : 'text-[#0a1124]/30 dark:text-white/30 hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <span className={`opacity-0 ${isSidebarLocked ? 'opacity-100' : 'group-hover/sidebar:opacity-100'} absolute left-4 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-500`}>
                {isSidebarLocked ? 'PINNED' : 'PIN PANEL'}
              </span>

              <div className={`w-10 h-10 flex items-center justify-center shrink-0 transition-all ${isSidebarLocked ? 'ml-auto' : 'group-hover/sidebar:ml-auto'}`}>
                <Pin size={14} className={`transition-transform duration-500 ${isSidebarLocked ? 'rotate-45' : ''}`} fill={isSidebarLocked ? "currentColor" : "none"} fillOpacity={isSidebarLocked ? 0.8 : 0} />
              </div>
            </button>
          </div>
        </div>

        {/* Right Sidebar - Status Intelligence */}
        <div className="w-full sm:w-[320px] bg-black/[0.02] dark:bg-[#0a1124] border-l border-black/5 dark:border-white/[0.05] p-6 flex flex-col gap-8 overflow-y-auto hidden sm:flex shrink-0 z-10">
          {/* Room Intelligence Module */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-black/20 dark:bg-white/20"></div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#0a1124] dark:text-white opacity-40">Room Members</span>
            </div>

            <div className="bg-white dark:bg-[#0d152b] border border-black/5 dark:border-white/[0.08] rounded-[32px] p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center -space-x-2.5 overflow-hidden">
                  {Object.values(userList).map((u, i) => (
                    <div key={i} className="relative group transition-transform hover:scale-110 active:scale-95" style={{ zIndex: 10 - i }}>
                      <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0d152b] bg-[#0a1124] overflow-hidden ring-1 ring-black/5 dark:ring-white/10 p-0.5">
                        {u.photoURL ? (
                          <img src={u.photoURL} title={u.name} className="w-full h-full rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-semibold uppercase">
                            {u.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold text-[#0a1124] dark:text-white uppercase tracking-tight">{userCount} Users</span>
                    <span className="text-[7px] font-semibold text-[#0a1124]/40 dark:text-white/30 uppercase tracking-[0.2em]">Active Now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security & Privacy Module */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
              <Shield size={12} className="text-[#0a1124]/40 dark:text-white/30" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#0a1124] dark:text-white opacity-40">Security Info</span>
            </div>

            <div className="bg-white dark:bg-[#0d152b] border border-black/5 dark:border-white/[0.08] rounded-[32px] p-5">
              <p className="text-[10px] text-[#0a1124]/60 dark:text-white/40 font-semibold leading-relaxed tracking-tight">
                <b className="text-[#0a1124] dark:text-white font-semibold uppercase tracking-wider text-[9px] block mb-2">Privacy Note:</b>
                Rooms are temporary and synced in real-time. Unsaved data is deleted when everyone leaves. Sign in to save projects permanently.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 dark:bg-black/90 backdrop-blur-md animate-fadeIn" onClick={() => setShowQR(false)}>
          <div className="bg-white p-12 rounded-[48px] flex flex-col items-center gap-8 shadow-2xl relative border border-black/5" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-white rounded-3xl shadow-inner border border-black/10"><QRCodeSVG value={roomPin} size={200} /></div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#0a1124]/30">Deployment Code</span>
              <span className="text-[24px] font-black tracking-[10px] ml-[10px] text-brand">{roomPin}</span>
            </div>
            <button onClick={() => setShowQR(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black/20 hover:text-black transition-all">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/80 backdrop-blur-md sm:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] z-[101] bg-white dark:bg-[#0a1124] flex flex-col sm:hidden shadow-2xl overflow-y-auto no-scrollbar border-r border-black/5 dark:border-white/[0.05]"
            >
              <div className="p-8 pb-20 flex flex-col h-full">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-[64px] h-[64px] rounded-full overflow-hidden shadow-xl border-2 border-brand/20 p-0.5 bg-brand/5">
                    {user?.photoURL ? (
                      <img src={user.photoURL} className="w-full h-full object-cover rounded-full" alt="" />
                    ) : (
                      <div className="w-full h-full bg-brand rounded-full flex items-center justify-center text-white font-black text-2xl uppercase">
                        {(user?.displayName || 'A').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-[18px] font-black tracking-tight text-[#0a1124] dark:text-white leading-tight">{user?.displayName || 'Anonymous'}</h2>
                    <p className="text-[10px] font-black text-brand uppercase tracking-[0.2em] mt-1">Personnel</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-8">
                  <button onClick={() => { navigator.clipboard.writeText(roomPin).then(() => alert('PIN Copied')); setIsMenuOpen(false); }}
                    className="flex items-center justify-between py-4 px-6 bg-brand text-white rounded-3xl shadow-xl shadow-brand/20 transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-3">
                      <Shield size={16} />
                      <span className="text-[11px] font-black uppercase tracking-widest">Copy PIN</span>
                    </div>
                    <span className="text-[14px] font-black tracking-[4px] opacity-40">{roomPin}</span>
                  </button>
                </div>

                <div className="flex flex-col gap-4 mb-8">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#0a1124]/30 dark:text-white/20">Participants</span>
                    <span className="text-[9px] font-black text-brand uppercase tracking-widest">{userCount} Online</span>
                  </div>
                  <div className="flex items-center p-4 bg-black/[0.02] dark:bg-white/[0.02] rounded-3xl border border-black/5 dark:border-white/[0.05]">
                    <div className="flex items-center -space-x-2.5">
                      {Object.values(userList).map((u, i) => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-[#0a1124] shadow-lg overflow-hidden">
                          {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-brand text-white flex items-center justify-center text-xs font-black">{u.name.charAt(0)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-8">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#0a1124]/30 dark:text-white/20">Tactical Tabs</span>
                    <button onClick={addTab} className="text-brand text-[8px] font-black uppercase tracking-widest">+ Add Tab</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {tabs.map((tab, idx) => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTabIndex(idx); setIsMenuOpen(false); }}
                        className={`w-full h-12 rounded-2xl flex items-center px-5 transition-all text-[10px] font-black uppercase tracking-widest ${idx === activeTabIndex ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/30'}`}
                      >
                        {tab.title || "Untitled Tab"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto">
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
