import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Dashboard from './components/Dashboard';
import AddMockDialog from './components/AddMockDialog';
import ProfileDialog from './components/ProfileDialog';
import CommunityHub from './components/CommunityHub';
import AdminDialog from './components/AdminDialog';
import ChallengeRequestsDialog from './components/ChallengeRequestsDialog';
import HiddenChallengesDialog from './components/HiddenChallengesDialog';
import { useMocks } from './hooks/useMocks';
import { useAuth } from './services/AuthContext';
import { useUserProfile } from './hooks/useUserProfile';
import { MockScore } from './types';
import { Plus, Target, LayoutDashboard, DatabaseZap, LogIn, Shield, Megaphone, ArrowRight, X, Sun, Moon, Users, Key, Pin, Pencil, Bold, Italic, Link as LinkIcon, Save, X as XIcon, Undo, Redo, Flame, Trash, Bell, EyeOff, BrainCircuit, LineChart, Trophy, Send, Timer, MessageSquare } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './services/firebase';
import AddLiveMockDialog from './components/AddLiveMockDialog';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

import { PublicProfileDialog } from './components/PublicProfileDialog';
import { ChallengeCard } from './components/ChallengeCard';
import { CreateChallengeDialog } from './components/CreateChallengeDialog';
import ChallengeRecycleBinDialog from './components/ChallengeRecycleBinDialog';

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
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const [isChallengeRecycleBinOpen, setIsChallengeRecycleBinOpen] = useState(false);
  const [isHiddenChallengesModalOpen, setIsHiddenChallengesModalOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isAddLiveMockOpen, setIsAddLiveMockOpen] = useState(false);
  const [isCreateChallengeOpen, setIsCreateChallengeOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<any>(null);
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
  const [challenges, setChallenges] = useState<any[]>([]);
  const [deletedChallenges, setDeletedChallenges] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [pinnedCountdowns, setPinnedCountdowns] = useState<string[]>([]);
  const [pinnedNotices, setPinnedNotices] = useState<string[]>([]);
  const [pinnedChallenges, setPinnedChallenges] = useState<string[]>([]);
  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [dismissedLiveMocks, setDismissedLiveMocks] = useState<string[]>(JSON.parse(localStorage.getItem('dismissedLiveMocks') || '[]'));
  const [dismissedChallenges, setDismissedChallenges] = useState<string[]>(JSON.parse(localStorage.getItem('dismissedChallenges') || '[]'));
  const [adminTab, setAdminTab] = useState<'users' | 'liveMock' | 'notice' | 'countdown' | 'challenge'>('users');
  const [adminEditNotice, setAdminEditNotice] = useState<any>(null);
  
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineNoticeTitle, setInlineNoticeTitle] = useState('');
  const [inlineNoticeDesc, setInlineNoticeDesc] = useState('');
  const [descHistory, setDescHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [telegramLink, setTelegramLink] = useState<string>('');

  useEffect(() => {
    const fetchPublicSettings = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'system', 'settings'));
        if (snap.exists()) {
          setTelegramLink(snap.data().telegramLink || '');
        }
      } catch (e) {
        console.error("Error fetching settings", e);
      }
    };
    fetchPublicSettings();
  }, []);

  const [now, setNow] = useState(new Date().getTime());
  
  const isAdmin = user?.email === 'mrityunjoyk29@gmail.com';

  const saveInlineNotice = async (id: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const updateData: any = {
        title: inlineNoticeTitle,
        description: inlineNoticeDesc,
        updatedAt: new Date().toISOString()
      };
      
      if (!isAdmin && user) {
        updateData.lastEditedBy = user.uid;
        updateData.lastEditedByEmail = user.email;
      }
      
      await updateDoc(doc(db, 'system', id), updateData);
      setNotices(notices.map(n => n.id === id ? { ...n, title: inlineNoticeTitle, description: inlineNoticeDesc, ...updateData } : n));
      setInlineEditingId(null);
      setDescHistory([]);
      setHistoryIndex(-1);
    } catch (e) {
      console.error(e);
      alert('Failed to save notice inline.');
    }
  };

  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);

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
      newPins.push(id); // Insert at the end so first pinned stays at top
      if (newPins.length > 3) {
        newPins = newPins.slice(newPins.length - 3); // Max 3 pins, keep the lastest 3 or keep the oldest 3? Wait, slice(-3) keeps the NEWEST 3, meaning the oldest drops off.
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

  const togglePinNotice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    
    let newPins = [...pinnedNotices];
    if (newPins.includes(id)) {
      newPins = newPins.filter(pid => pid !== id);
    } else {
      newPins.push(id); // Insert at the end to keep first pinned at top
    }
    
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'system', 'config'), { 
        pinnedNotices: newPins,
        updatedAt: new Date().toISOString() 
      }, { merge: true });
      setPinnedNotices(newPins);
    } catch (err) {
      console.error("Error pinning notice:", err);
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

  const dismissChallenge = (id: string) => {
    const updated = [...dismissedChallenges, id];
    setDismissedChallenges(updated);
    localStorage.setItem('dismissedChallenges', JSON.stringify(updated));
  };

  const unhideChallenge = (id: string) => {
    const updated = dismissedChallenges.filter((cid) => cid !== id);
    setDismissedChallenges(updated);
    if (updated.length === 0) {
      localStorage.removeItem('dismissedChallenges');
    } else {
      localStorage.setItem('dismissedChallenges', JSON.stringify(updated));
    }
  };

  const restoreChallenges = () => {
    setDismissedChallenges([]);
    localStorage.removeItem('dismissedChallenges');
  };

  const fetchAnnouncement = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(collection(db, 'system')));
      const chalSnap = await getDocs(query(collection(db, 'challenges')));
      
      let activeNotices: any[] = [];
      let activeCountdowns: any[] = [];
      let mocks: any[] = [];
      let activeChallenges: any[] = [];
      let delChallenges: any[] = [];
      let pins: string[] = [];
      let noticePins: string[] = [];
      const nowTs = new Date().getTime();
      snap.forEach(d => {
        const data = d.data();
        if (d.id === 'config') {
          pins = data.pinnedCountdowns || [];
          noticePins = data.pinnedNotices || [];
          setPinnedChallenges(data.pinnedChallenges || []);
        } else if (data.type === 'notice') {
          if (data.date && new Date(data.date).getTime() < nowTs) return;
          activeNotices.push({ id: d.id, ...data });
        } else if (data.type === 'liveMock') {
            if (data.date && new Date(data.date).getTime() < nowTs) return;
            mocks.push({ id: d.id, ...data });
        } else if (data.type === 'countdown') {
            if (data.date && new Date(data.date).getTime() < nowTs) return;
            activeCountdowns.push({ id: d.id, ...data });
        }
      });
      
      chalSnap.forEach(d => {
        const data = d.data();
        const isDeletedByCreator = data.deletedByCreator === true;
        const isPermanentlyDeletedByCreator = data.permanentlyDeletedByCreator === true;
        const isDeletedByAdmin = data.deletedByAdmin === true;
        const isPermanentlyDeletedByAdmin = data.permanentlyDeletedByAdmin === true;

        if (data.status === 'active' || data.status === undefined) {
           if (data.creatorId === user?.uid) {
              if (isPermanentlyDeletedByCreator) {
                  return; // Don't show to creator anywhere
              }
              if (isDeletedByCreator) {
                  delChallenges.push({ id: d.id, ...data });
                  return;
              }
           } else {
              if (isAdmin) {
                 if (isPermanentlyDeletedByAdmin) {
                     return;
                 }
                 if (isDeletedByAdmin) {
                     delChallenges.push({ id: d.id, ...data });
                     return;
                 }
              } else {
                 if (isDeletedByAdmin || isPermanentlyDeletedByAdmin) {
                     return;
                 }
              }

              if (data.visibility === 'personal' && data.creatorId !== user?.uid) {
                return;
              }
              if (data.visibility === 'global') {
                if (data.approvalStatus === 'pending') {
                  // Only creator and admin can see pending global challenges
                  if (data.creatorId !== user?.uid && !isAdmin) {
                    return;
                  }
                } else if (data.approvalStatus === 'rejected') {
                  // Only creator sees rejected global challenges (vanishes from admin and public)
                  if (data.creatorId !== user?.uid) {
                    return;
                  }
                }
              }
           }
           activeChallenges.push({ id: d.id, ...data });
        } else if (data.status === 'deleted') {
           if (data.creatorId === user?.uid && !isPermanentlyDeletedByCreator) {
             delChallenges.push({ id: d.id, ...data });
           } else if (isAdmin && data.creatorId !== user?.uid && !isPermanentlyDeletedByAdmin) {
             delChallenges.push({ id: d.id, ...data });
           }
        }
      });

      activeCountdowns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setNotices(activeNotices);
      setChallenges(activeChallenges);
      setDeletedChallenges(delChallenges);
      setPinnedCountdowns(pins);
      setPinnedNotices(noticePins);
      setCountdowns(activeCountdowns);
      setLiveMocks(mocks);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnnouncement();
      // Refresh every minute or when admin/user modal closes
      const interval = setInterval(fetchAnnouncement, 60000);
      return () => clearInterval(interval);
    }
  }, [user, isAdminModalOpen, isCreateChallengeOpen, isRequestsModalOpen]);

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

  const handleEditChallenge = (challenge: any) => {
    // If editing from requests modal, close the requests modal so form is visible
    setIsRequestsModalOpen(false);
    setEditingChallenge(challenge);
    setIsCreateChallengeOpen(true);
  };

  const handleApproveChallenge = async (id: string) => {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'challenges', id), { approvalStatus: 'approved' }, { merge: true });
      await fetchAnnouncement();
      alert("Challenge approved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to approve challenge: " + error);
    }
  };

  const handleRejectChallenge = async (id: string) => {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'challenges', id), { approvalStatus: 'rejected' }, { merge: true });
      await fetchAnnouncement();
      alert("Challenge rejected successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to reject challenge: " + error);
    }
  };

  const handleDeleteChallenge = async (challenge: any) => {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      if (isAdmin && challenge.creatorId !== user?.uid) {
          await setDoc(doc(db, 'challenges', challenge.id), { deletedByAdmin: true }, { merge: true });
      } else if (challenge.visibility === 'global' && challenge.approvalStatus === 'approved') {
          await setDoc(doc(db, 'challenges', challenge.id), { deletedByCreator: true }, { merge: true });
      } else {
          await setDoc(doc(db, 'challenges', challenge.id), { status: 'deleted' }, { merge: true });
      }
      await fetchAnnouncement();
      console.log('Challenge deleted successfully');
    } catch (e) {
      console.error("Error deleting challenge", e);
      alert("Failed to delete challenge.");
    }
  };

  const handlePinChallenge = async (challenge: any) => {
    if (!isAdmin) return;
    
    let newPins = [...pinnedChallenges];
    if (newPins.includes(challenge.id)) {
      newPins = newPins.filter(pid => pid !== challenge.id);
    } else {
      newPins.push(challenge.id);
      if (newPins.length > 3) {
        newPins = newPins.slice(newPins.length - 3);
      }
    }

    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'system', 'config'), { 
        pinnedChallenges: newPins,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setPinnedChallenges(newPins);
      await fetchAnnouncement();
    } catch (e) {
      console.error("Error pinning challenge", e);
    }
  };

  const handleRestoreChallenge = async (challenge: any) => {
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      if (isAdmin && challenge.creatorId !== user?.uid) {
          await setDoc(doc(db, 'challenges', challenge.id), { deletedByAdmin: false, permanentlyDeletedByAdmin: false }, { merge: true });
      } else {
          await setDoc(doc(db, 'challenges', challenge.id), { status: 'active', deletedByCreator: false, permanentlyDeletedByCreator: false }, { merge: true });
      }
      await fetchAnnouncement();
      console.log('Challenge restored successfully');
    } catch (e) {
      console.error("Error restoring challenge", e);
      alert("Failed to restore challenge.");
    }
  };

  const handlePermanentlyDeleteChallenge = async (challenge: any) => {
    try {
      const { deleteDoc, doc, setDoc } = await import('firebase/firestore');
      if (isAdmin && challenge.creatorId !== user?.uid) {
          await setDoc(doc(db, 'challenges', challenge.id), { permanentlyDeletedByAdmin: true }, { merge: true });
      } else if (challenge.visibility === 'global' && challenge.approvalStatus === 'approved') {
          await setDoc(doc(db, 'challenges', challenge.id), { permanentlyDeletedByCreator: true }, { merge: true });
      } else {
          await deleteDoc(doc(db, 'challenges', challenge.id));
      }
      await fetchAnnouncement();
      console.log('Challenge permanently deleted');
    } catch (e) {
      console.error("Error permanently deleting challenge", e);
      alert("Failed to permanently delete challenge.");
    }
  };

  const handleCloseCreateChallenge = () => {
    setIsCreateChallengeOpen(false);
    setTimeout(() => setEditingChallenge(null), 300);
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
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
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

                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 md:mx-2 hidden lg:block"></div>

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
                <>
                  <button
                    onClick={signInWithGoogle}
                    className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </button>

                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 md:mx-2 hidden sm:block"></div>

                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-1.5 md:p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex"
                  >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-full mx-auto px-[15px] sm:px-6 lg:px-8 py-8 pt-[25px] w-full">
        {!user ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] text-center max-w-6xl mx-auto px-4 lg:overflow-hidden lg:-mt-4">
             <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 shadow-inner">
              <DatabaseZap className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
              Track Your Mock Exams Intelligently
            </h2>
            <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 mb-8 max-w-2xl leading-relaxed">
              Upload your mock test scorecard images. Our AI will automatically extract your scores and percentiles. 
              Safely store your historical data across all sessions and track your sectional weak points.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-left w-full">
              <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">AI Scorecard Extraction</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Just upload a screenshot of your result. Our AI instantly parses and logs all scores.</p>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-400">
                  <LineChart className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">Deep Trend Analytics</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Track your performance over time with beautiful charts and hit rates.</p>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center mb-3 text-rose-600 dark:text-rose-400">
                  <Timer className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">Challenges & Countdowns</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Join daily task challenges to build streaks and track upcoming live exams visually.</p>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-3 text-amber-600 dark:text-amber-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">Community Chat</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Engage with aspirants, view leaderboards, share insights, and prep together.</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign In to Start Tracking
              </button>

              {telegramLink && (
                <a
                  href={telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-lg transition-colors mt-2"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Contact us
                </a>
              )}
            </div>
          </div>
        ) : mocksLoading ? (
           <div className="flex flex-col items-center justify-center min-h-[60vh]">
             <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
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
                    <div key={c.id} className={`flex-shrink-0 w-[205px] sm:w-[225px] p-4 rounded-xl ${theme.bg} border ${theme.border} flex flex-col justify-between overflow-hidden relative shadow-sm snap-start`} style={{ marginBottom: '0px', marginTop: '0px', paddingBottom: '16px', marginRight: '0px' }}>
                      <div className="mb-3 relative z-10 flex justify-between items-start gap-2">
                         <h3 className={`font-black text-slate-800 dark:text-slate-100 truncate flex-1 animate-subtle-float text-lg sm:text-[21px]`} style={{ lineHeight: '1.2', fontFamily: '"Times New Roman", Times, serif', marginTop: '-4px', paddingLeft: '0px', paddingRight: '0px', marginLeft: '-4px', marginRight: '-22px', textAlign: 'left' }} title={c.title}>{c.title}</h3>
                      </div>
                      
                      <div className="flex flex-col relative z-10" style={{ paddingLeft: '0px', paddingTop: '0px', marginTop: '-14px' }}>
                        <div className="flex items-center justify-between" style={{ paddingTop: '0px', marginTop: '14px', marginBottom: '5px' }}>
                          <div className="flex items-center gap-3">
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
                          
                          {isAdmin && (
                            <button onClick={(e) => togglePin(c.id, e)} className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95 ${isPinned ? theme.pop : 'text-slate-400 dark:text-slate-500'}`} title={isPinned ? "Unpin" : "Pin"}>
                               <Pin className="w-4 h-4" style={{ marginLeft: '0px', marginRight: '-18px', marginBottom: '6px' }} />
                            </button>
                          )}
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
            {[...notices].sort((a, b) => {
              const aIdx = pinnedNotices.indexOf(a.id);
              const bIdx = pinnedNotices.indexOf(b.id);
              if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
              if (aIdx !== -1) return -1;
              if (bIdx !== -1) return 1;
              return (b.createdAt || 0) - (a.createdAt || 0);
            }).filter(n => activeTab === 'dashboard' || pinnedNotices.includes(n.id)).map((n) => {
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
              <div 
                key={n.id} 
                className={`mb-5 mt-0 p-[12px] rounded-2xl bg-gradient-to-r ${c.bg} border shadow-sm relative overflow-hidden ${(!isAdmin && n.editableBy === 'users') ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (!isAdmin && n.editableBy === 'users') {
                    setActiveNoticeId(prev => prev === n.id ? null : n.id);
                  }
                }}
              >
                <div className={`absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 pointer-events-none`}>
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
                <div className="relative z-10 w-full flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-2 pr-8">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] uppercase font-bold tracking-wider animate-notice-tag-pulse shrink-0 ${c.pill}`}>{n.urgency ? `Notice: ${n.urgency === 'error' ? 'Urgent' : n.urgency}` : 'Notice'}</span>
                      </div>
                      <h2 className="text-[17px] sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{n.title}</h2>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {n.tags && n.tags.length > 0 && n.tags.map((tag: string, i: number) => (
                          <span key={i} className="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[10px] sm:text-xs font-medium bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 shrink-0">
                            #{tag.replace(/^#/, '')}
                          </span>
                        ))}
                      </div>
                    </div>
                    {n.description && (
                      <div className="text-slate-700 dark:text-slate-300 text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap markdown-body mt-2">
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
                    {isAdmin && n.lastEditedByEmail && (
                      <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 font-medium italic">
                        Last edited by: {n.lastEditedByEmail}
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
                {((isAdmin && inlineEditingId !== n.id) || (!isAdmin && n.editableBy === 'users' && activeNoticeId === n.id && inlineEditingId !== n.id)) && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                    {isAdmin && (
                      <button
                        onClick={(e) => togglePinNotice(n.id, e)}
                        className={`p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 ${pinnedNotices.includes(n.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
                        title={pinnedNotices.includes(n.id) ? "Unpin Notice" : "Pin Notice"}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditingId(n.id);
                        setInlineNoticeTitle(n.title || '');
                        setInlineNoticeDesc(n.description || '');
                        setDescHistory([n.description || '']);
                        setHistoryIndex(0);
                      }}
                      className="p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95"
                      title={isAdmin ? "Edit Notice Inline" : "Edit Notice"}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )})}

            {/* Challenges */}
            {(challenges.length > 0 || user) && (
              <div className="mb-6">
                <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 mt-6 flex-nowrap w-full">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white flex items-center gap-1 sm:gap-2 min-w-0">
                    <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
                    <span className="truncate">Active Challenges</span>
                  </h2>
                  {user && (
                    <button 
                      onClick={() => setIsCreateChallengeOpen(true)}
                      className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors ml-1 sm:ml-2 shrink-0" 
                      title="Create Challenge"
                    >
                      <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
                    {dismissedChallenges.length > 0 && (
                      <button 
                        onClick={() => setIsHiddenChallengesModalOpen(true)} 
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 relative"
                        title={`Hidden Challenges (${dismissedChallenges.length})`}
                      >
                        <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="absolute -top-1 -right-1 bg-slate-500 text-white text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full font-bold">
                          {dismissedChallenges.length}
                        </span>
                      </button>
                    )}
                    {isAdmin && challenges.some(c => c.visibility === 'global' && c.approvalStatus === 'pending') && (
                      <button
                        onClick={() => setIsRequestsModalOpen(true)}
                        className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shrink-0 relative"
                        title={`Requests (${challenges.filter(c => c.visibility === 'global' && c.approvalStatus === 'pending').length})`}
                      >
                        <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full font-bold">
                          {challenges.filter(c => c.visibility === 'global' && c.approvalStatus === 'pending').length}
                        </span>
                      </button>
                    )}
                    {user && deletedChallenges.length > 0 && (
                      <button
                        onClick={() => setIsChallengeRecycleBinOpen(true)}
                        className="p-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-full transition-colors flex items-center justify-center relative shrink-0"
                        title={`Recycle Bin (${deletedChallenges.length})`}
                      >
                        <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full font-bold">
                          {deletedChallenges.length}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {challenges.filter(c => {
                  const isVisible = (c.creatorId === user?.uid || !(c.visibility === 'global' && (c.approvalStatus === 'pending' || c.approvalStatus === 'rejected'))) && !dismissedChallenges.includes(c.id);
                  if (!isVisible) return false;
                  if (activeTab === 'community') return pinnedChallenges.includes(c.id);
                  return true;
                }).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {challenges
                      .filter(c => {
                         const isVisible = (c.creatorId === user?.uid || !(c.visibility === 'global' && (c.approvalStatus === 'pending' || c.approvalStatus === 'rejected'))) && !dismissedChallenges.includes(c.id);
                         if (!isVisible) return false;
                         if (activeTab === 'community') return pinnedChallenges.includes(c.id);
                         return true;
                      })
                      .sort((a, b) => {
                         const aP = pinnedChallenges.includes(a.id);
                         const bP = pinnedChallenges.includes(b.id);
                         if (aP && !bP) return -1;
                         if (!aP && bP) return 1;
                         return 0;
                      })
                      .map(challenge => (
                      <ChallengeCard 
                        key={challenge.id} 
                        challenge={{ ...challenge, isPinned: pinnedChallenges.includes(challenge.id) }}
                        onEdit={handleEditChallenge}
                        onDelete={handleDeleteChallenge}
                        onDismiss={dismissChallenge}
                        onPin={handlePinChallenge}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <p className="text-sm">No active challenges available. Click the + button to create one!</p>
                  </div>
                )}
              </div>
            )}

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
              </div>
            ))}

            <section className="w-full">
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
                      onUpdateProfileTasks={async (tasks) => {
                        if (!profile) return;
                        const { doc, setDoc } = await import('firebase/firestore');
                        await setDoc(doc(db, 'users', profile.userId), { tasks }, { merge: true });
                      }}
                    />
                  ) : (
                    <CommunityHub 
                       onCopyMock={handleCopyMock} 
                       onUserClick={(u) => setActivePublicProfile(u)}
                       isAdmin={isAdmin}
                       pinnedChallenges={pinnedChallenges}
                       challenges={challenges}
                       onPinChallenge={handlePinChallenge}
                       onEditChallenge={handleEditChallenge}
                       onDeleteChallenge={handleDeleteChallenge}
                       onDismissChallenge={dismissChallenge}
                    />
                  )}
                </>
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
        <ChallengeRequestsDialog
          isOpen={isRequestsModalOpen}
          onClose={() => setIsRequestsModalOpen(false)}
          challenges={challenges}
          onApprove={handleApproveChallenge}
          onReject={handleRejectChallenge}
          onEdit={handleEditChallenge}
        />
      )}

      {user && (
        <ChallengeRecycleBinDialog
          isOpen={isChallengeRecycleBinOpen}
          onClose={() => setIsChallengeRecycleBinOpen(false)}
          deletedChallenges={deletedChallenges}
          onRestore={handleRestoreChallenge}
          onPermanentlyDelete={handlePermanentlyDeleteChallenge}
          isAdmin={isAdmin}
        />
      )}

      {user && (
        <HiddenChallengesDialog
          isOpen={isHiddenChallengesModalOpen}
          onClose={() => setIsHiddenChallengesModalOpen(false)}
          hiddenChallenges={challenges.filter(c => dismissedChallenges.includes(c.id))}
          onRestore={unhideChallenge}
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

      {user && (
        <CreateChallengeDialog
          isOpen={isCreateChallengeOpen}
          onClose={handleCloseCreateChallenge}
          uid={user.uid}
          initialData={editingChallenge}
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
