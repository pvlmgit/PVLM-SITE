import React, { useState, useEffect } from 'react';
import { auth, googleProvider, database } from './lib/firebase';
import { signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, onValue, set, onDisconnect } from 'firebase/database';
import Header from './components/Header';
import JoinScreen from './components/JoinScreen';
import EditorScreen from './components/EditorScreen';
import FeedbackScreen from './components/FeedbackScreen';
import ProfileModal from './components/ProfileModal';
import PublicChatScreen from './components/PublicChatScreen';

function App() {
  const [screen, setScreen] = useState('join');
  const [roomPin, setRoomPin] = useState('');
  const [user, setUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [stats, setStats] = useState({ active: 0, total: 0 });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    // Stats Tracking
    const today = new Date().toISOString().split('T')[0];
    const visitorKey = localStorage.getItem('visitorKey') || `user_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem('visitorKey', visitorKey);

    const totalUsersRef = ref(database, 'SYNCTEXT/stats/totalUsersByIp');
    const unsubTotal = onValue(totalUsersRef, (snap) => {
      setStats(prev => ({ ...prev, total: Object.keys(snap.val() || {}).length }));
    });

    const activeTodayRef = ref(database, `SYNCTEXT/stats/activeTodayByIp/${today}`);
    const unsubActive = onValue(activeTodayRef, (snap) => {
      setStats(prev => ({ ...prev, active: Object.keys(snap.val() || {}).length }));
    });

    // Presence
    const setupPresence = async () => {
      const ts = Date.now();
      await set(ref(database, `SYNCTEXT/stats/totalUsersByIp/${visitorKey}`), { lastSeenAt: ts });
      await set(ref(database, `SYNCTEXT/stats/activeTodayByIp/${today}/${visitorKey}`), { lastSeenAt: ts });
      const onlineRef = ref(database, `SYNCTEXT/stats/onlineUsersByIp/${visitorKey}`);
      await set(onlineRef, { lastSeenAt: ts });
      onDisconnect(onlineRef).remove();
    };
    setupPresence();

    return () => {
      unsubAuth();
      unsubTotal();
      unsubActive();
    };
  }, []);

  const getGoogleLoginErrorMessage = (error) => {
    const code = error?.code || '';
    const host = window.location.hostname || 'unknown-host';
    if (code === 'auth/unauthorized-domain') {
      return `Google login blocked: unauthorized domain.\nAdd this host in Firebase Auth > Settings > Authorized domains:\n${host}`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Google login is disabled. Enable Google provider in Firebase Authentication.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Popup blocked by browser. Allow popups or try again.';
    }
    return `Google login failed (${code || 'unknown error'})`;
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          alert(getGoogleLoginErrorMessage(redirectError));
          return;
        }
      }
      alert(getGoogleLoginErrorMessage(e));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowProfile(false);
  };

  const handleJoinFromProfile = (pin) => {
    setRoomPin(pin);
    setScreen('editor');
    setShowProfile(false);
  };

  return (
    <div className="h-screen bg-surface dark:bg-[#0a1124] flex flex-col transition-colors duration-500 overflow-hidden">
      {screen !== 'editor' && (
        <Header 
          stats={stats} 
          user={user} 
          onShowProfile={() => setShowProfile(true)} 
          onLogin={handleLogin}
        />
      )}

      <main className={`flex-1 flex items-start sm:items-center justify-center overflow-hidden ${screen === 'editor' ? 'p-0 sm:p-6 sm:pt-10' : 'p-0 sm:p-4'}`}>
        {screen === 'join' ? (
          <JoinScreen 
            setScreen={setScreen} 
            setRoomPin={setRoomPin} 
            user={user} 
            onShowProfile={() => setShowProfile(true)} 
            onShowFeedback={() => setScreen('feedback')}
            onShowPublicChat={() => setScreen('publicChat')}
            onLogin={handleLogin}
          />
        ) : screen === 'publicChat' ? (
          <PublicChatScreen 
            setScreen={setScreen} 
            user={user} 
          />
        ) : screen === 'editor' ? (
          <EditorScreen 
            roomPin={roomPin} 
            setScreen={setScreen} 
            user={user} 
            onShowProfile={() => setShowProfile(true)}
            onLogin={handleLogin}
            onShowPublicChat={() => setScreen('publicChat')}
            onShowFeedback={() => setScreen('feedback')}
          />
        ) : screen === 'feedback' ? (
          <FeedbackScreen 
            user={user} 
            setScreen={setScreen}
            onLogin={handleLogin}
          />
        ) : null}
      </main>

      {/* Feedback now handled as a screen */}

      {showProfile && user && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfile(false)} 
          onLogout={handleLogout}
          onJoinRoom={handleJoinFromProfile}
        />
      )}
    </div>
  );
}

export default App;
