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
import { Plus, Target, LayoutDashboard, DatabaseZap, LogIn, Shield, Megaphone, ArrowRight, X, Sun, Moon, Users, Key, Pin, Pencil, Bold, Italic, Link as LinkIcon, Save, X as XIcon, Undo, Redo } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from './services/firebase';
import AddLiveMockDialog from './components/AddLiveMockDialog';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
  const [pinnedCountdowns, setPinnedCountdowns] = useState<string[]>([]);
  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [dismissedLiveMocks, setDismissedLiveMocks] = useState<string[]>(JSON.parse(localStorage.getItem('dismissedLiveMocks') || '[]'));
  const [adminTab, setAdminTab] = useState<'users' | 'liveMock' | 'notice' | 'countdown'>('users');
  const [adminEditNotice, setAdminEditNotice] = useState<any>(null);
  
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineNoticeTitle, setInlineNoticeTitle] = useState('');
  const [inlineNoticeDesc, setInlineNoticeDesc] = useState('');
  const [descHistory, setDescHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [now, setNow] = useState(new Date().getTime());
  
  const isAdmin = user?.email === 'mrityunjoyk29@gmail.com';

  const saveInlineNotice = async (id: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'system', id), {
        title: inlineNoticeTitle,
        description: inlineNoticeDesc
      });
      setNotices(notices.map(n => n.id === id ? { ...n, title: inlineNoticeTitle, description: inlineNoticeDesc } : n));
      setInlineEditingId(null);
      setDescHistory([]);
      setHistoryIndex(-1);
    } catch (e) {
      console.error(e);
      alert('Failed to save notice inline.');
    }
  };

  const applyInlineFormat = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const len = textarea.value.length;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end, len);
    
    setInlineNoticeDesc(newText);
    
    const newHistory = descHistory.slice(0, historyIndex + 1);
    newHistory.push(newText);
    setDescHistory(newHistory.slice(-50));
    setHistoryIndex(Math.min(newHistory.length - 1, 49));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };
  
  const handleDescChange = (val: string) => {
      setInlineNoticeDesc(val);
      const lastVal = descHistory[historyIndex];
      // Push history if significant change or words are completed
      if (!lastVal || Math.abs(val.length - lastVal.length) > 1 || val.endsWith(' ') || val.endsWith('\n')) {
          const newHistory = descHistory.slice(0, historyIndex + 1);
          newHistory.push(val);
          setDescHistory(newHistory.slice(-50));
          setHistoryIndex(Math.min(newHistory.length - 1, 49));
      }
  };
  
  const undo = () => {
      if (inlineNoticeDesc !== descHistory[historyIndex] && historyIndex >= 0) {
          setInlineNoticeDesc(descHistory[historyIndex]);
      } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInlineNoticeDesc(descHistory[historyIndex - 1]);
      }
  };

  const redo = () => {
      if (historyIndex < descHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInlineNoticeDesc(descHistory[historyIndex + 1]);
      }
  };
  
  const togglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    
    let newPins = [...pinnedCountdowns];
    if (newPins.includes(id)) {
      newPins = newPins.filter(pid => pid !== id);
    } else {
      newPins.unshift(id); // Insert at the beginning
      if (newPins.length > 3) {
        newPins = newPins.slice(0, 3); // Max 3 pins
      }
    }
    
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'system', 'config'), { 
        pinnedCountdowns: newPins,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      setPinnedCountdowns(newPins);
    } catch (err) {
      console.error("Error pinning countdown:", err);
    }
  };

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
          let pins: string[] = [];
          const now = new Date().getTime();
          snap.forEach(d => {
            const data = d.data();
            if (d.id === 'config') {
              pins = data.pinnedCountdowns || [];
            } else if (data.type === 'notice') {
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
          setPinnedCountdowns(pins);
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

  const handleUpdateReflection = async (id: string, updates: Partial<MockScore>) => {
    const mockToUpdate = mocks.find(m => m.id === id);
    if (!mockToUpdate) return;
    await updateMock({ ...mockToUpdate, ...updates });
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] font-sans text-slate-900 dark:text-slate-200 pb-[45px] pl-[0px] transition-colors duration-200">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsApiModalOpen(true)} title="Configure API Key">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <img src="/icon-192.svg" alt="MockTracker" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-lg sm:text-[21px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 group-hover:from-blue-800 group-hover:to-indigo-800 transition-colors" style={{ marginLeft: '-7px', paddingLeft: '0px', paddingRight: '5px' }}>
                MockTracker <span className="hidden sm:inline-block text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1">by Joy</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? (
                <>
                  <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                    <button
                      onClick={() => { setActiveTab(activeTab === 'dashboard' ? 'community' : 'dashboard'); window.scrollTo(0, 0); }}
                      className="px-2 sm:px-3 py-1.5 lg:hidden text-xs font-medium rounded-lg transition-all bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700 w-9 sm:w-auto hover:bg-slate-200 dark:hover:bg-slate-700"
                      title={activeTab === 'dashboard' ? 'Community' : 'My Mocks'}
                    >
                      {activeTab === 'dashboard' ? (
                        <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>

                    {/* Desktop Tabs */}
                    <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl relative">
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
                    className="inline-flex items-center justify-center p-2 lg:px-4 text-sm font-medium text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4 lg:mr-1.5" />
                    <span className="hidden lg:inline">Add Mock</span>
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
                      onClick={() => {
                        setAdminTab('users');
                        setAdminEditNotice(null);
                        setIsAdminModalOpen(true);
                       }}
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
      <main className="max-w-7xl mx-auto px-[15px] sm:px-6 lg:px-8 py-8 pt-[25px] w-full">
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
              <div className="flex gap-3 overflow-x-auto custom-scrollbar snap-x" style={{ marginBottom: '25px', marginTop: '0px', paddingBottom: '0px' }}>
                {[...countdowns].sort((a, b) => {
                  const aIdx = pinnedCountdowns.indexOf(a.id);
                  const bIdx = pinnedCountdowns.indexOf(b.id);
                  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                  if (aIdx !== -1) return -1;
                  if (bIdx !== -1) return 1;
                  return 0;
                }).map(c => {
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

                  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const formattedDate = `${daysShort[targetDate.getDay()].toLowerCase()} ${targetDate.getDate().toString().padStart(2, '0')} ${monthsShort[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`;

                  const isPinned = pinnedCountdowns.includes(c.id);

                  return (
                    <div key={c.id} className={`flex-shrink-0 w-[155px] xs:w-[180px] md:w-[240px] p-4 rounded-xl ${theme.bg} border ${theme.border} flex flex-col justify-between overflow-hidden relative shadow-sm snap-start`} style={{ marginBottom: '0px', marginTop: '0px', paddingBottom: '16px', marginRight: '0px' }}>
                      <div className="mb-3 relative z-10 flex justify-between items-start gap-2">
                         <h3 className={`font-black text-slate-800 dark:text-slate-100 truncate flex-1 animate-subtle-float`} style={{ fontSize: '21px', lineHeight: '35px', fontFamily: '"Times New Roman", Times, serif', fontStyle: 'normal', textDecoration: 'none', paddingLeft: '0px', paddingTop: '3px', paddingBottom: '0px', marginLeft: '0px', marginRight: '-22px', marginTop: '-10px', textAlign: 'left' }} title={c.title}>{c.title}</h3>
                         {isAdmin && (
                           <button onClick={(e) => togglePin(c.id, e)} className={`p-1 mt-[-6px] mr-[-6px] rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0 ${isPinned ? theme.pop : 'text-slate-400 dark:text-slate-500'}`} title={isPinned ? "Unpin" : "Pin"}>
                              <Pin className="w-4 h-4" style={{ marginLeft: '0px', marginRight: '-10px' }} />
                           </button>
                         )}
                      </div>
                      
                      <div className="flex flex-col relative z-10" style={{ paddingLeft: '0px', paddingTop: '0px', marginTop: '-14px' }}>
                        <div className="flex items-center gap-3" style={{ paddingTop: '0px', marginTop: '14px', marginBottom: '5px' }}>
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
                        <div className={`h-6 w-full rounded-full overflow-hidden mb-2 relative flex items-center justify-center ${theme.barBg}`}>
                          <div className={`absolute top-0 left-0 h-full rounded-full ${theme.bar} transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }} />
                          {/* Shuttle animation overlay */}
                          <div className="absolute inset-0 w-full h-full pointer-events-none">
                            <div className="w-full h-full bg-linear-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg] animate-shuttle" />
                          </div>
                          <span className={`relative z-10 text-[11px] font-bold px-2 py-0.5 rounded tracking-wide text-white`}>
                            {formattedDate}
                          </span>
                        </div>
                      </div>
                      
                      <div className="h-4" style={{ marginLeft: '0px', marginTop: '-5px', marginBottom: '-8px', paddingBottom: '0px', paddingRight: '0px' }}>
                        {c.note && (
                          <p className={`text-xs font-semibold italic truncate`} style={{ color: '#ed3838', paddingLeft: '5px', paddingTop: '1px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }} title={c.note}>{c.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notices */}
            {notices.map((n) => {
              const u = n.urgency || 'info'; // default to info if no urgency
              const configs: Record<string, any> = {
                warning: {
                  bg: 'from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/10 dark:via-yellow-900/10 dark:to-amber-900/10 border-amber-100 dark:border-amber-900/30',
                  icon: 'text-amber-900 dark:text-amber-500',
                  pill: 'bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400',
                  button: 'text-amber-900 bg-amber-200 hover:bg-amber-300'
                },
                info: {
                  bg: 'from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-blue-900/10 border-blue-100 dark:border-blue-900/30',
                  icon: 'text-blue-900 dark:text-blue-500',
                  pill: 'bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400',
                  button: 'text-blue-900 bg-blue-200 hover:bg-blue-300'
                },
                error: {
                  bg: 'from-red-50 via-rose-50 to-red-50 dark:from-red-900/10 dark:via-rose-900/10 dark:to-red-900/10 border-red-100 dark:border-red-900/30',
                  icon: 'text-red-900 dark:text-red-500',
                  pill: 'bg-red-200 dark:bg-red-500/20 text-red-800 dark:text-red-400',
                  button: 'text-red-900 bg-red-200 hover:bg-red-300'
                }
              };
              
              const c = configs[u] || configs.info;
              
              let textWithLinks = n.description ? n.description.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1[$2]($2)') : '';
              textWithLinks = textWithLinks
                  .replace(/<red>([\s\S]*?)<\/red>/gi, '<span class="text-red-500 font-semibold">$1</span>')
                  .replace(/<blue>([\s\S]*?)<\/blue>/gi, '<span class="text-blue-500 font-semibold">$1</span>')
                  .replace(/<green>([\s\S]*?)<\/green>/gi, '<span class="text-emerald-500 font-semibold">$1</span>')
                  .replace(/<amber>([\s\S]*?)<\/amber>/gi, '<span class="text-amber-500 font-semibold">$1</span>');

              return (
              <div key={n.id} className={`mb-5 mt-0 p-[12px] rounded-2xl bg-gradient-to-r ${c.bg} border shadow-sm relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 p-6 opacity-5 dark:opacity-10`}>
                  <Megaphone className={`w-32 h-32 ${c.icon}`} />
                </div>
                {inlineEditingId === n.id ? (
                   <div className="relative z-20 w-full flex flex-col gap-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm backdrop-blur-sm">
                     <div className="flex items-center justify-between">
                       <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Inline Editing</h3>
                       <div className="flex gap-2">
                         <button onClick={() => saveInlineNotice(n.id)} className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-colors" title="Save changes">
                           <Save className="w-4 h-4" />
                         </button>
                         <button onClick={() => setInlineEditingId(null)} className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md transition-colors" title="Cancel">
                           <XIcon className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                     <input
                       type="text"
                       value={inlineNoticeTitle}
                       onChange={e => setInlineNoticeTitle(e.target.value)}
                       className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100"
                       placeholder="Notice Title"
                     />
                     <textarea
                       ref={textareaRef}
                       value={inlineNoticeDesc}
                       onChange={e => handleDescChange(e.target.value)}
                       rows={4}
                       className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                       placeholder="Notice description (Markdown)..."
                     />
                     <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                       <button onClick={undo} disabled={historyIndex <= 0 && inlineNoticeDesc === descHistory[historyIndex]} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-50" title="Undo"><Undo className="w-4 h-4" /></button>
                       <button onClick={redo} disabled={historyIndex >= descHistory.length - 1} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-50" title="Redo"><Redo className="w-4 h-4" /></button>
                       <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                       <button onClick={() => applyInlineFormat('**', '**')} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Bold"><Bold className="w-4 h-4" /></button>
                       <button onClick={() => applyInlineFormat('*', '*')} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Italic"><Italic className="w-4 h-4" /></button>
                       <button onClick={() => applyInlineFormat('[', '](https://)')} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Link"><LinkIcon className="w-4 h-4" /></button>
                       <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                       <button onClick={() => applyInlineFormat('<red>', '</red>')} className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50">Red</button>
                       <button onClick={() => applyInlineFormat('<blue>', '</blue>')} className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50">Blue</button>
                       <button onClick={() => applyInlineFormat('<green>', '</green>')} className="px-2 py-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 rounded border border-emerald-200 dark:border-emerald-900/50">Green</button>
                       <button onClick={() => applyInlineFormat('<amber>', '</amber>')} className="px-2 py-1 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-900/50">Amber</button>
                     </div>
                   </div>
                ) : (
                <div className="relative z-10 max-w-3xl flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5 pr-8">
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider animate-notice-tag-pulse ${c.pill}`}>{n.urgency ? `Notice: ${n.urgency}` : 'Notice'}</span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{n.title}</h2>
                      {n.tags && n.tags.length > 0 && n.tags.map((tag: string, i: number) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300">
                          #{tag.replace(/^#/, '')}
                        </span>
                      ))}
                    </div>
                    {n.description && (
                      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap markdown-body mt-2">
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw as any]}
                          components={{
                            a: ({node, ...props}) => {
                               if (props.href?.startsWith('#')) {
                                   return <span className={`font-semibold ${c.icon}`}>{props.children}</span>
                               }
                               return <a {...props} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium" target="_blank" rel="noopener noreferrer" />
                            },
                            ul: ({node, ...props}) => <ul {...props} className="list-disc pl-5 my-2" />,
                            ol: ({node, ...props}) => <ol {...props} className="list-decimal pl-5 my-2" />,
                            p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />,
                            strong: ({node, ...props}) => <strong {...props} className="font-bold text-slate-900 dark:text-white" />
                          }}
                        >{textWithLinks}</Markdown>
                      </div>
                    )}
                  </div>
                  {n.link && (
                    <div className="flex-shrink-0 mt-2 md:mt-0">
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition-all rounded-xl hover:shadow-md ${c.button}`}
                      >
                        View Details
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </a>
                    </div>
                  )}
                </div>
                )}
                {isAdmin && inlineEditingId !== n.id && (
                  <button
                    onClick={() => {
                      setInlineEditingId(n.id);
                      setInlineNoticeTitle(n.title || '');
                      setInlineNoticeDesc(n.description || '');
                      setDescHistory([n.description || '']);
                      setHistoryIndex(0);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl transition-all shadow-sm z-30 border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95"
                    title="Edit Notice Inline"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )})}

            {/* Live Mocks or Default Banner */}
            {activeTab === 'dashboard' && (liveMocks.filter(lm => !mocks.some(m => m.mockName === lm.mockName && m.examType === lm.examType) && !dismissedLiveMocks.includes(lm.id)).length > 0 ? (
               <div className="mb-5 mt-0 pt-[12px] pb-[0px] pl-[0px] pr-[12px]" style={{ paddingBottom: '0px', paddingLeft: '0px' }}>
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
                     <div key={liveMock.id} className="min-w-[220px] md:min-w-[260px] flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800/30 shadow-sm relative overflow-hidden snap-start">
                       
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
              <div className="relative mb-5 mt-0 pt-[12px] pb-[0px] pl-[0px] pr-[12px]" style={{ paddingBottom: '0px', paddingLeft: '0px' }}>
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
          initialTab={adminTab}
          editNoticeData={adminEditNotice}
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
