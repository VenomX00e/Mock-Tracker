import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Dashboard from './components/Dashboard';
import AddMockDialog from './components/AddMockDialog';
import ProfileDialog from './components/ProfileDialog';
import CommunityHub from './components/CommunityHub';
import AdminDialog from './components/AdminDialog';
import { useMocks } from './hooks/useMocks';
import { useAuth } from './services/AuthContext';
import { useUserProfile } from './hooks/useUserProfile';
import { MockScore } from './types';
import { Plus, Target, LayoutDashboard, DatabaseZap, LogIn, Shield, Megaphone, ArrowRight, X, Sun, Moon, Users, Key } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from './services/firebase';
import AddLiveMockDialog from './components/AddLiveMockDialog';

import { PublicProfileDialog } from './components/PublicProfileDialog';

export default function App() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const { profile } = useUserProfile();
  const { mocks, deletedMocks, loading: mocksLoading, addMock, updateMock, deleteMock, permanentlyDeleteMock, restoreDeletedMock } = useMocks();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activePublicProfile, setActivePublicProfile] = useState<any>(null);
  const [mockToEdit, setMockToEdit] = useState<MockScore | undefined>(undefined);
  
  // Admin & Announcement states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAddLiveMockOpen, setIsAddLiveMockOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('geminiApiKey') || '');

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' || false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'community'>('dashboard');
  const [notices, setNotices] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [dismissedLiveMocks, setDismissedLiveMocks] = useState<string[]>(JSON.parse(localStorage.getItem('dismissedLiveMocks') || '[]'));
  const [now, setNow] = useState(new Date().getTime());

  const dismissLiveMock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...dismissedLiveMocks, id];
    setDismissedLiveMocks(updated);
    localStorage.setItem('dismissedLiveMocks', JSON.stringify(updated));
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('geminiApiKey', apiKeyInput);
    setIsApiModalOpen(false);
  };

  const restoreLiveMocks = () => {
    setDismissedLiveMocks([]);
    localStorage.removeItem('dismissedLiveMocks');
  };

  useEffect(() => {
    if (user) {
      const fetchAnnouncement = async () => {
        try {
          const snap = await getDocs(query(collection(db, 'system')));
          let activeNotices: any[] = [];
          let activeCountdowns: any[] = [];
          let mocks: any[] = [];
          const now = new Date().getTime();
          snap.forEach(d => {
            const data = d.data();
            if (data.type === 'notice') {
                if (data.date && new Date(data.date).getTime() < now) return;
                activeNotices.push({ id: d.id, ...data });
            } else if (data.type === 'liveMock') {
                if (data.date && new Date(data.date).getTime() < now) return;
                mocks.push({ id: d.id, ...data });
            } else if (data.type === 'countdown') {
                if (data.date && new Date(data.date).getTime() < now) return;
                activeCountdowns.push({ id: d.id, ...data });
            }
          });
          
          activeCountdowns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          setNotices(activeNotices);
          setCountdowns(activeCountdowns);
          setLiveMocks(mocks);
        } catch (e) {
          console.error(e);
        }
      };
      // Fetch once and refresh every minute or when admin modal closes
      fetchAnnouncement();
      const interval = setInterval(fetchAnnouncement, 60000);
      return () => clearInterval(interval);
    }
  }, [user, isAdminModalOpen]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date().getTime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const getCountdownFormat = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return { days, hours };
  };

  const handleEditMock = (mock: MockScore) => {
    setMockToEdit(mock);
    setIsAddModalOpen(true);
  };

  const handleUpdateReflection = async (id: string, note: string, tags: string[]) => {
    const mockToUpdate = mocks.find(m => m.id === id);
    if (!mockToUpdate) return;
    await updateMock({ ...mockToUpdate, note, tags });
  };

  const handleDeleteMock = (id: string) => {
    deleteMock(id);
  };

  const handleCopyMock = (mock: MockScore) => {
    // Copy the details but remove the ID so it's treated as a new entry
    const copiedMock = { ...mock, id: '', score: '', percentile: '', percentage: '', accuracy: '', quant: { score: '', percentile: '', accuracy: '' }, reasoning: { score: '', percentile: '', accuracy: '' }, english: { score: '', percentile: '', accuracy: '' }, ga: { score: '', percentile: '', accuracy: '' }};
    setMockToEdit(copiedMock as any);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setTimeout(() => setMockToEdit(undefined), 300);
  };

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile?.isBanned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm border border-slate-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
             <DatabaseZap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Account Banned</h1>
          <p className="text-slate-600 mb-6">Your access to this application has been suspended by an administrator.</p>
          <button onClick={logout} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email === 'mrityunjoyk29@gmail.com';

  const handleMuteUser = async (userId: string, isMuted: boolean) => {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./services/firebase');
    await setDoc(doc(db, 'users', userId), { isMuted }, { merge: true });
    setActivePublicProfile((prev: any) => prev ? { ...prev, isMuted } : null);
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./services/firebase');
    await setDoc(doc(db, 'users', userId), { isBanned }, { merge: true });
    setActivePublicProfile((prev: any) => prev ? { ...prev, isBanned } : null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] font-sans text-slate-900 dark:text-slate-200 pb-16 transition-colors duration-200">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsApiModalOpen(true)} title="Configure API Key">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <img src="/icon-192.svg" alt="MockTracker" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-base sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 group-hover:from-blue-800 group-hover:to-indigo-800 transition-colors">
                MockTracker <span className="text-[10px] sm:text-xs font-normal text-slate-500 dark:text-slate-400 ml-1 hidden sm:inline">by Joy</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                    <button
                      onClick={() => { setActiveTab(activeTab === 'dashboard' ? 'community' : 'dashboard'); window.scrollTo(0, 0); }}
                      className="px-2 sm:px-3 py-1.5 md:hidden text-xs font-medium rounded-lg transition-all bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700 w-9 sm:w-auto hover:bg-slate-200 dark:hover:bg-slate-700"
                      title={activeTab === 'dashboard' ? 'Community' : 'My Mocks'}
                    >
                      {activeTab === 'dashboard' ? (
                        <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>

                    {/* Desktop Tabs */}
                    <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl relative">
                      <button
                        onClick={() => { setActiveTab('dashboard'); window.scrollTo(0, 0); }}
                        className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 ${
                          activeTab === 'dashboard' 
                            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent'
                        }`}
                      >
                        <span className="relative z-10 block pointer-events-none">My Mocks</span>
                      </button>
                      <button
                        onClick={() => { setActiveTab('community'); window.scrollTo(0, 0); }}
                        className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 ${
                          activeTab === 'community' 
                            ? 'text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent'
                        }`}
                      >
                        <span className="relative z-10 block pointer-events-none">Community</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center p-2 md:px-4 text-sm font-medium text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4 md:mr-1.5" />
                    <span className="hidden md:inline">Add Mock</span>
                  </button>

                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5 md:mx-1 hidden sm:block"></div>

                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-1.5 md:p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex"
                  >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => setIsAdminModalOpen(true)}
                      className="p-1.5 md:p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent rounded-lg transition-colors"
                      title="Admin Dashboard"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  )}

                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 md:p-1.5 rounded-lg transition-colors border border-transparent"
                    onClick={() => setIsProfileModalOpen(true)}
                  >
                    <img src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                  </div>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {!user ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto px-4">
             <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-8 text-blue-600 shadow-inner">
              <DatabaseZap className="w-10 h-10" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Track Your Mock Exams Intelligently
            </h2>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed">
              Upload your mock test scorecard images. Our AI will automatically extract your scores and percentiles. 
              Safely store your historical data across all sessions and track your sectional weak points.
            </p>
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In to Start Tracking
            </button>
          </div>
        ) : (
          <>
            {/* Countdowns */}
            {activeTab === 'dashboard' && countdowns.length > 0 && (
              <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {countdowns.map(c => {
                  const { days, hours } = getCountdownFormat(c.date);
                  
                  const getThemeColors = (color: string) => {
                     switch(color) {
                       case 'green': return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-600 dark:text-emerald-400', label: 'text-emerald-400 dark:text-emerald-500', bar: 'bg-emerald-500', barBg: 'bg-emerald-200 dark:bg-emerald-900/50', pop: 'text-emerald-700 dark:text-emerald-300', note: 'text-emerald-600/80 dark:text-emerald-400/80' };
                       case 'light-green': return { bg: 'bg-lime-50 dark:bg-lime-900/10', border: 'border-lime-200 dark:border-lime-800/50', text: 'text-lime-600 dark:text-lime-400', label: 'text-lime-500 dark:text-lime-600', bar: 'bg-lime-500', barBg: 'bg-lime-200 dark:bg-lime-900/50', pop: 'text-lime-700 dark:text-lime-300', note: 'text-lime-600/80 dark:text-lime-400/80' };
                       case 'orange': return { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800/50', text: 'text-orange-600 dark:text-orange-400', label: 'text-orange-400 dark:text-orange-500', bar: 'bg-orange-500', barBg: 'bg-orange-200 dark:bg-orange-900/50', pop: 'text-orange-700 dark:text-orange-300', note: 'text-orange-600/80 dark:text-orange-400/80' };
                       case 'light-red': return { bg: 'bg-rose-50 dark:bg-rose-900/10', border: 'border-rose-200 dark:border-rose-800/50', text: 'text-rose-500 dark:text-rose-400', label: 'text-rose-400 dark:text-rose-500', bar: 'bg-rose-400', barBg: 'bg-rose-200 dark:bg-rose-900/50', pop: 'text-rose-600 dark:text-rose-300', note: 'text-rose-500/80 dark:text-rose-400/80' };
                       case 'red': return { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400', label: 'text-red-400 dark:text-red-500', bar: 'bg-red-600', barBg: 'bg-red-200 dark:bg-red-900/50', pop: 'text-red-700 dark:text-red-400', note: 'text-red-600/80 dark:text-red-400/80' };
                       default: return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-600 dark:text-emerald-400', label: 'text-emerald-400 dark:text-emerald-500', bar: 'bg-emerald-500', barBg: 'bg-emerald-200 dark:bg-emerald-900/50', pop: 'text-emerald-700 dark:text-emerald-300', note: 'text-emerald-600/80 dark:text-emerald-400/80' };
                     }
                  };
                  
                  const theme = getThemeColors(c.color || 'green');
                  
                  // Calculate progress
                  const targetDate = new Date(c.date);
                  const targetTime = targetDate.getTime();
                  // Progress starts from Jan 1st of the target year
                  const createdTime = new Date(targetDate.getFullYear(), 0, 1).getTime();
                  const total = targetTime - createdTime;
                  const remaining = targetTime - now;
                  const progress = Math.max(0, Math.min(100, 100 - (remaining / total) * 100));

                  return (
                    <div key={c.id} className={`p-4 rounded-xl ${theme.bg} border ${theme.border} flex flex-col justify-between overflow-hidden relative shadow-sm`}>
                      <div className="mb-3 relative z-10">
                         <h3 className={`font-black text-slate-800 dark:text-slate-100 truncate`} style={{ fontSize: '26px', fontFamily: '"Times New Roman", Times, serif', fontStyle: 'normal', textDecoration: 'none' }} title={c.title}>{c.title}</h3>
                      </div>
                      
                      <div className="flex flex-col relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-base font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider`}>IN</span>
                          <div className="flex items-baseline gap-2">
                            <div className="flex flex-col items-center">
                              <span className={`text-2xl font-black ${theme.text} leading-none`}>{days}</span>
                              <span className={`text-[9px] uppercase font-bold ${theme.label} tracking-wider mt-0.5`}>Days</span>
                            </div>
                            <span className={`text-lg font-bold ${theme.label} opacity-50`}>:</span>
                            <div className="flex flex-col items-center">
                              <span className={`text-2xl font-black ${theme.text} leading-none`}>{hours}</span>
                              <span className={`text-[9px] uppercase font-bold ${theme.label} tracking-wider mt-0.5`}>Hrs</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Progress bar as divider */}
                        <div className={`h-1.5 w-full rounded-full overflow-hidden mb-2 ${theme.barBg}`}>
                          <div className={`h-full rounded-full ${theme.bar} transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      
                      <div className="h-4">
                        {c.note && (
                          <p className={`text-xs font-semibold italic truncate`} style={{ color: '#ed3838' }} title={c.note}>{c.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notices */}
            {notices.map((n) => (
              <div key={n.id} className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/10 dark:via-yellow-900/10 dark:to-amber-900/10 border border-amber-100 dark:border-amber-900/30 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10">
                  <Megaphone className="w-32 h-32 text-amber-900 dark:text-amber-500" />
                </div>
                <div className="relative z-10 max-w-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400">Notice</span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{n.title}</h2>
                    </div>
                    {n.description && (
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {n.description}
                      </p>
                    )}
                  </div>
                  {n.link && (
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => window.open(n.link, '_blank')}
                        className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-amber-900 transition-all bg-amber-200 rounded-xl hover:bg-amber-300 hover:shadow-md"
                      >
                        View Details
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Live Mocks or Default Banner */}
            {activeTab === 'dashboard' && (liveMocks.filter(lm => !mocks.some(m => m.mockName === lm.mockName && m.examType === lm.examType) && !dismissedLiveMocks.includes(lm.id)).length > 0 ? (
               <div>
                 <div className="flex justify-between items-center mb-3">
                   <div className="flex items-center gap-2">
                     <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Active Live Mocks</h3>
                     <button onClick={() => setIsAddLiveMockOpen(true)} className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors" title="Host Live Mock">
                       <Plus className="w-4 h-4" />
                     </button>
                   </div>
                   {dismissedLiveMocks.length > 0 && (
                     <button onClick={restoreLiveMocks} className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Show hidden Live Mocks</button>
                   )}
                 </div>
                 <div className="mb-8 flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                   {liveMocks.filter(lm => !mocks.some(m => m.mockName === lm.mockName && m.examType === lm.examType) && !dismissedLiveMocks.includes(lm.id)).map(liveMock => (
                     <div key={liveMock.id} className="min-w-[280px] md:min-w-[320px] flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800/30 shadow-sm relative overflow-hidden snap-start">
                       
                       <button onClick={(e) => dismissLiveMock(liveMock.id, e)} className="absolute top-2 right-2 p-1.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-full text-indigo-400 dark:text-indigo-500 hover:text-rose-500 transition-colors z-20" title="Hide Live Mock">
                         <X className="w-3 h-3" />
                       </button>

                       <div className="absolute top-0 right-0 p-3 opacity-5 dark:opacity-10">
                         <Target className="w-16 h-16 text-indigo-900 dark:text-indigo-400" />
                       </div>
                       <div className="relative z-10 flex flex-col h-full justify-between">
                       <div>
                         <div className="flex items-center gap-2 mb-2">
                           <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-600 dark:bg-indigo-500 text-white animate-pulse">Live</span>
                           <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">{liveMock.examType} {liveMock.examRole && liveMock.examRole}</span>
                         </div>
                         <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{liveMock.mockName}</h3>
                         <p className="text-slate-600 dark:text-slate-400 text-xs mb-4">{liveMock.platform || 'Any Platform'} • {liveMock.examPhase} • {liveMock.examScope}</p>
                       </div>
                       <button
                         onClick={() => {
                           setMockToEdit({
                              id: '', mockName: liveMock.mockName, date: liveMock.date || new Date().toISOString(), platform: liveMock.platform,
                              score: '', percentile: '', percentage: '', accuracy: '',
                              examType: liveMock.examType || '', examRole: liveMock.examRole || '', examPhase: liveMock.examPhase || '', examScope: liveMock.examScope || '',
                              quant: {score:'', percentile:'', accuracy:''}, reasoning:{score:'', percentile:'', accuracy:''}, english:{score:'', percentile:'', accuracy:''}, ga:{score:'', percentile:'', accuracy:''}
                           } as any);
                           setIsAddModalOpen(true);
                         }}
                         className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-700 hover:shadow-md mt-2"
                       >
                         Share My Score
                         <ArrowRight className="w-4 h-4 ml-2" />
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
            ) : (
              <div className="mb-8 relative">
                 <div className="flex justify-between items-center mb-3">
                   <div className="flex items-center gap-2">
                     <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Active Live Mocks</h3>
                     <button onClick={() => setIsAddLiveMockOpen(true)} className="p-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors" title="Host Live Mock">
                       <Plus className="w-4 h-4" />
                     </button>
                   </div>
                   {dismissedLiveMocks.length > 0 && (
                     <button onClick={restoreLiveMocks} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">Show hidden Live Mocks</button>
                   )}
                 </div>
                 <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <DatabaseZap className="w-48 h-48" />
                  </div>
                <div className="relative z-10 max-w-2xl">
                  <h2 className="text-2xl font-semibold mb-2">Track your progress to crack the exam</h2>
                  <p className="text-indigo-200 text-sm leading-relaxed mb-6">
                    Upload your mock test scorecard images. Our AI will automatically extract your scores and percentiles. 
                    Analyze your performance across different exams and identify your weak sections.
                  </p>
                  <div className="flex items-center gap-4 text-sm font-medium text-indigo-100">
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                      <Target className="w-4 h-4" /> AI Data Extraction
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                      <LayoutDashboard className="w-4 h-4" /> Sectional Analytics
                    </div>
                  </div>
                </div>
              </div>
              </div>
            ))}

            <section className="w-full">
              {mocksLoading ? (
                 <div className="flex justify-center p-12">
                   <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : (
                <>
                  {activeTab === 'dashboard' ? (
                    <Dashboard 
                      mocks={mocks} 
                      deletedMocks={deletedMocks}
                      profile={profile || undefined}
                      onDeleteMock={handleDeleteMock} 
                      onEditMock={handleEditMock} 
                      onRestoreMock={restoreDeletedMock}
                      onPermanentlyDeleteMock={permanentlyDeleteMock}
                      onUpdateReflection={handleUpdateReflection}
                    />
                  ) : (
                    <CommunityHub 
                       onCopyMock={handleCopyMock} 
                       onUserClick={(u) => setActivePublicProfile(u)}
                       isAdmin={isAdmin}
                    />
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      {/* Add Mock Modal */}
      {user && (
        <AddMockDialog 
          isOpen={isAddModalOpen} 
          onClose={handleCloseModal} 
          initialMock={mockToEdit}
          onSave={(mock) => {
            if (mockToEdit?.id) {
              updateMock(mock);
            } else {
              addMock(mock);
            }
            handleCloseModal();
          }} 
        />
      )}

      {user && (
        <ProfileDialog
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {activePublicProfile && (
         <PublicProfileDialog
            isOpen={true}
            onClose={() => setActivePublicProfile(null)}
            profile={activePublicProfile}
            isCurrentUser={user?.uid === activePublicProfile.userId}
            onEditProfile={() => setIsProfileModalOpen(true)}
            isAdmin={isAdmin}
            onMuteUser={handleMuteUser}
            onBanUser={handleBanUser}
         />
      )}

      {isAdmin && (
        <AdminDialog 
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
        />
      )}

      {user && (
        <AddLiveMockDialog
           isOpen={isAddLiveMockOpen}
           onClose={() => setIsAddLiveMockOpen(false)}
           onSuccess={() => setIsAddLiveMockOpen(false)}
        />
      )}

      {/* API Key Modal */}
      {isApiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Configure Gemini API Key</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">To use the AI image extraction feature, paste your free Gemini API key below.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="AIzaSy..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 dark:shadow-none transition-all"
                >
                  Save Key
                </button>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-400 mb-1">How to get a key?</h4>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
                1. Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold hover:text-blue-600 dark:hover:text-blue-400">Google AI Studio</a>.<br/>
                2. Click "Create API Key".<br/>
                3. Copy and paste it here. It's 100% free.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
