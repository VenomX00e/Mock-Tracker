import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../types';
import { Shield, UserX, UserCheck, MessageSquareOff, MessageSquare, AlertCircle, Save, X, Radio, FileText, Users, Calendar, Timer, Trash2 } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { EXAMS, ROLES, PHASES, SCOPES, PLATFORMS } from '../lib/constants';
import { parseMockAnnouncementImage } from '../services/geminiService';

interface AdminDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'users' | 'liveMock' | 'notice' | 'countdown' | 'challenge';
  editNoticeData?: any;
}

import { useAuth } from '../services/AuthContext';

export default function AdminDialog({ isOpen, onClose, initialTab = 'users', editNoticeData = null }: AdminDialogProps) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'liveMock' | 'notice' | 'countdown' | 'challenge'>(initialTab as any);

  // Challenge inputs
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDescription, setChallengeDescription] = useState('');
  const [challengeType, setChallengeType] = useState('streak');
  const [challengeStartDate, setChallengeStartDate] = useState('');
  const [challengeEndDate, setChallengeEndDate] = useState('');
  const [challengeDuration, setChallengeDuration] = useState('');
  const [challengeTasks, setChallengeTasks] = useState<{id: string, text: string}[]>([]);
  const [challengeTodoFrequency, setChallengeTodoFrequency] = useState<'oneTime' | 'daily'>('daily');
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);

  const [bannedUsers, setBannedUsers] = useState<UserProfile[]>([]);
  const [mutedUsers, setMutedUsers] = useState<UserProfile[]>([]);
  const [allAppUsers, setAllAppUsers] = useState<UserProfile[]>([]);
  const [allFirebaseUsers, setAllFirebaseUsers] = useState<UserProfile[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live mock & notice inputs
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDescription, setNoticeDescription] = useState('');
  const [noticeLink, setNoticeLink] = useState('');
  const [noticeDate, setNoticeDate] = useState('');
  const [noticeUrgency, setNoticeUrgency] = useState('');
  const [noticeTags, setNoticeTags] = useState('');
  const [noticeEditableBy, setNoticeEditableBy] = useState<'admin' | 'users'>('admin');
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  // Countdown inputs
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownDate, setCountdownDate] = useState('');
  const [countdownNote, setCountdownNote] = useState('');
  const [countdownColor, setCountdownColor] = useState('green');
  const [editingCountdownId, setEditingCountdownId] = useState<string | null>(null);
  
  // Custom states for Live Mock
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [editingLiveMockId, setEditingLiveMockId] = useState<string | null>(null);

  const [liveMockData, setLiveMockData] = useState({
    examType: '',
    examRole: '',
    examPhase: 'Prelims',
    examScope: 'Full',
    mockName: '',
    platform: '',
    date: '',
  });

  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
    if (editNoticeData && initialTab === 'notice') {
      setEditingNoticeId(editNoticeData.id);
      setNoticeTitle(editNoticeData.title || '');
      setNoticeDescription(editNoticeData.description || '');
      setNoticeLink(editNoticeData.link || '');
      setNoticeDate(editNoticeData.date || '');
      setNoticeUrgency(editNoticeData.urgency || '');
      setNoticeTags(Array.isArray(editNoticeData.tags) ? editNoticeData.tags.join(', ') : (editNoticeData.tags || ''));
      setNoticeEditableBy(editNoticeData.editableBy || 'admin');
    }
  }, [initialTab, editNoticeData, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchAnnouncement();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => d.data() as UserProfile);
      setBannedUsers(allUsers.filter(u => u.isBanned));
      setMutedUsers(allUsers.filter(u => u.isMuted && !u.isBanned));
      setAllAppUsers(allUsers.filter(u => !u.isBanned && !u.isMuted && u.totalTests > 0 && u.userId !== currentUser?.uid));
      setAllFirebaseUsers(allUsers.filter(u => u.userId !== currentUser?.uid));
    } catch (error) {
      console.error("Error fetching users", error);
    }
    setLoading(false);
  };

  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [countdowns, setCountdowns] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);

  const fetchAnnouncement = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'system')));
      const chalSnap = await getDocs(query(collection(db, 'challenges')));
      const tempMocks: any[] = [];
      const tempNotices: any[] = [];
      const tempCountdowns: any[] = [];
      const tempChallenges: any[] = [];
      
      snap.forEach(d => {
        const data = d.data();
        if (data.type === 'notice') {
          tempNotices.push({ id: d.id, ...data });
        } else if (data.type === 'liveMock') {
          tempMocks.push({ id: d.id, ...data });
        } else if (data.type === 'countdown') {
          tempCountdowns.push({ id: d.id, ...data });
        }
      });
      
      chalSnap.forEach(d => {
         tempChallenges.push({ id: d.id, ...d.data() });
      });

      setLiveMocks(tempMocks);
      setNotices(tempNotices);
      setCountdowns(tempCountdowns);
      setChallenges(tempChallenges);
    } catch (error) {
      console.error(error);
    }
  };

  const saveNotice = async () => {
    setSavingAnnouncement(true);
    try {
      if (!noticeTitle) {
        alert("Notice title is required");
        setSavingAnnouncement(false);
        return;
      }
      const newId = editingNoticeId || `notice_${Date.now()}`;
      await setDoc(doc(db, 'system', newId), {
        type: 'notice',
        title: noticeTitle,
        description: noticeDescription,
        link: noticeLink,
        date: noticeDate,
        urgency: noticeUrgency,
        tags: noticeTags.split(',').map(t => t.trim()).filter(Boolean),
        editableBy: noticeEditableBy,
        updatedAt: new Date().toISOString()
      }, { merge: !!editingNoticeId });
      alert(editingNoticeId ? "Notice updated successfully" : "Notice saved successfully");
      setEditingNoticeId(null);
      setNoticeTitle('');
      setNoticeDescription('');
      setNoticeLink('');
      setNoticeDate('');
      setNoticeUrgency('');
      setNoticeTags('');
      setNoticeEditableBy('admin');
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving notice", error);
      alert("Failed to save notice");
    }
    setSavingAnnouncement(false);
  };

  const handleEditNotice = (n: any) => {
    setEditingNoticeId(n.id);
    setNoticeTitle(n.title || '');
    setNoticeDescription(n.description || '');
    setNoticeLink(n.link || '');
    setNoticeDate(n.date || '');
    setNoticeUrgency(n.urgency || 'info');
    setNoticeTags(Array.isArray(n.tags) ? n.tags.join(', ') : '');
    setNoticeEditableBy(n.editableBy || 'admin');
  };

  const saveLiveMock = async () => {
    setSavingAnnouncement(true);
    try {
      if (!liveMockData.mockName || !liveMockData.examType) {
        alert("Mock Name and Exam Type are required.");
        setSavingAnnouncement(false);
        return;
      }
      const newId = editingLiveMockId || `liveMock_${Date.now()}`;
      await setDoc(doc(db, 'system', newId), {
        type: 'liveMock',
        ...liveMockData,
        title: `Live: ${liveMockData.mockName}`,
        description: `Join the community in taking the ${liveMockData.examType} ${liveMockData.examRole} ${liveMockData.examPhase} mock on ${liveMockData.platform || 'any platform'}.`,
        link: '',
        updatedAt: new Date().toISOString()
      }, { merge: !!editingLiveMockId });
      alert(editingLiveMockId ? "Live Mock updated successfully" : "Live Mock saved successfully");
      setEditingLiveMockId(null);
      setLiveMockData({
        examType: '', examRole: '', examPhase: 'Prelims', examScope: 'Full', mockName: '', platform: '', date: ''
      });
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving live mock", error);
      alert("Failed to save live mock");
    }
    setSavingAnnouncement(false);
  };

  const handleEditLiveMock = (m: any) => {
    setEditingLiveMockId(m.id);
    if (!EXAMS.includes(m.examType)) setIsCustomExam(true); else setIsCustomExam(false);
    if (!ROLES.includes(m.examRole)) setIsCustomRole(true); else setIsCustomRole(false);
    if (!PHASES.includes(m.examPhase)) setIsCustomPhase(true); else setIsCustomPhase(false);
    if (!PLATFORMS.includes(m.platform)) setIsCustomPlatform(true); else setIsCustomPlatform(false);
    
    setLiveMockData({
      examType: m.examType || '',
      examRole: m.examRole || '',
      examPhase: m.examPhase || 'Prelims',
      examScope: m.examScope || 'Full',
      mockName: m.mockName || '',
      platform: m.platform || '',
      date: m.date || '',
    });
  };

  const deleteLiveMock = async (id: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'system', id));
      fetchAnnouncement();
    } catch(e) {
      console.error(e);
      alert("Failed to delete live mock");
    }
  };

  const saveChallenge = async () => {
    setSavingAnnouncement(true);
    try {
      if (!challengeTitle || !challengeStartDate || !challengeEndDate) {
        alert("Challenge title, start date and end date are required");
        setSavingAnnouncement(false);
        return;
      }
      const start = new Date(challengeStartDate).getTime();
      const end = new Date(challengeEndDate).getTime();
      if (end <= start) {
         alert("End date must be after start date");
         setSavingAnnouncement(false);
         return;
      }
      const durationDays = challengeDuration ? parseInt(challengeDuration) : Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const newId = editingChallengeId || `challenge_${Date.now()}`;
      const cleanTasks = challengeTasks.map(t => ({...t, text: t.text.trim()})).filter(t => t.text.length > 0);
      const payload: any = {
        title: challengeTitle,
        description: challengeDescription || '',
        challengeType: challengeType,
        todoFrequency: challengeTodoFrequency,
        durationDays: durationDays,
        startDate: challengeStartDate,
        endDate: challengeEndDate,
        status: 'active',
        tasks: cleanTasks,
        updatedAt: new Date().toISOString()
      };
      if (!editingChallengeId) {
        payload.createdAt = new Date().toISOString();
      }
      await setDoc(doc(db, 'challenges', newId), payload, { merge: !!editingChallengeId });
      alert(editingChallengeId ? "Challenge updated successfully" : "Challenge saved successfully");
      setEditingChallengeId(null);
      setChallengeTitle('');
      setChallengeDescription('');
      setChallengeType('streak');
      setChallengeStartDate('');
      setChallengeEndDate('');
      setChallengeDuration('');
      setChallengeTasks([]);
      setChallengeTodoFrequency('daily');
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving challenge", error);
      alert("Failed to save challenge");
    }
    setSavingAnnouncement(false);
  };

  const handleEditChallenge = (c: any) => {
    setEditingChallengeId(c.id);
    setChallengeTitle(c.title || '');
    setChallengeDescription(c.description || '');
    setChallengeType(c.challengeType || 'streak');
    setChallengeStartDate(c.startDate?.split('T')[0] || '');
    setChallengeEndDate(c.endDate?.split('T')[0] || '');
    setChallengeDuration(c.durationDays ? c.durationDays.toString() : '');
    setChallengeTasks(c.tasks || []);
    setChallengeTodoFrequency(c.todoFrequency || 'daily');
  };

  const approveChallenge = async (challengeId: string) => {
    try {
      await setDoc(doc(db, 'challenges', challengeId), { approvalStatus: 'approved' }, { merge: true });
      fetchAnnouncement();
    } catch (error) {
      console.error(error);
      alert("Failed to approve challenge");
    }
  };

  const rejectChallenge = async (challengeId: string) => {
    try {
      await setDoc(doc(db, 'challenges', challengeId), { approvalStatus: 'rejected' }, { merge: true });
      fetchAnnouncement();
    } catch (error) {
      console.error(error);
      alert("Failed to reject challenge");
    }
  };

  const deleteChallenge = async (id: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'challenges', id));
      fetchAnnouncement();
    } catch(e) {
      console.error(e);
      alert("Failed to delete challenge");
    }
  };

  const saveCountdown = async () => {
    setSavingAnnouncement(true);
    try {
      if (!countdownTitle || !countdownDate) {
        alert("Countdown title and date are required");
        setSavingAnnouncement(false);
        return;
      }
      const newId = editingCountdownId || `countdown_${Date.now()}`;
      const payload: any = {
        type: 'countdown',
        title: countdownTitle,
        date: countdownDate,
        note: countdownNote || '',
        color: countdownColor,
        updatedAt: new Date().toISOString()
      };
      if (!editingCountdownId) {
        payload.createdAt = new Date().toISOString();
      }
      await setDoc(doc(db, 'system', newId), payload, { merge: !!editingCountdownId });
      alert(editingCountdownId ? "Countdown updated successfully" : "Countdown saved successfully");
      setEditingCountdownId(null);
      setCountdownTitle('');
      setCountdownDate('');
      setCountdownNote('');
      setCountdownColor('green');
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving countdown", error);
      alert("Failed to save countdown");
    }
    setSavingAnnouncement(false);
  };

  const handleEditCountdown = (c: any) => {
    setEditingCountdownId(c.id);
    setCountdownTitle(c.title || '');
    setCountdownDate(c.date || '');
    setCountdownNote(c.note || '');
    setCountdownColor(c.color || 'green');
  };

  const deleteCountdown = async (id: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'system', id));
      fetchAnnouncement();
    } catch(e) {
      console.error(e);
      alert("Failed to delete countdown");
    }
  };

  const deleteNotice = async (id: string) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'system', id));
      fetchAnnouncement();
    } catch(e) {
      console.error(e);
      alert("Failed to delete notice");
    }
  };

  const handleUpdateUserStatus = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await setDoc(doc(db, 'users', userId), updates, { merge: true });
      fetchUsers();
    } catch (e) {
      console.error("Failed to update user", e);
    }
  };

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsProcessingImage(true);

    try {
      const imagesPayload: { base64: string, mimeType: string }[] = [];
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
             const result = reader.result?.toString().split(',')[1];
             if (result) resolve(result);
             else reject(new Error("Failed to read file"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imagesPayload.push({ base64: base64Data, mimeType: file.type });
      }

      if (imagesPayload.length > 0) {
        const extractedData = await parseMockAnnouncementImage(imagesPayload);
        
        if (extractedData.examType && !EXAMS.includes(extractedData.examType)) setIsCustomExam(true);
        if (extractedData.examRole && !ROLES.includes(extractedData.examRole)) setIsCustomRole(true);
        if (extractedData.examPhase && !PHASES.includes(extractedData.examPhase)) setIsCustomPhase(true);
        if (extractedData.platform && !PLATFORMS.includes(extractedData.platform)) setIsCustomPlatform(true);

        setLiveMockData((prev: any) => ({ 
          ...prev, 
          ...extractedData,
          examPhase: extractedData.examPhase || prev.examPhase,
          examScope: extractedData.examScope || prev.examScope
        }));
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to process images');
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 flex flex-col md:flex-row h-[85vh] border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-100 dark:border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Admin</h2>
          </div>
          <div className="p-3 space-y-1 flex-1 overflow-y-auto">
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Users className="w-4 h-4" /> User Management
            </button>
            <button 
              onClick={() => setActiveTab('liveMock')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'liveMock' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Radio className="w-4 h-4" /> Live Mock
            </button>
            <button 
              onClick={() => setActiveTab('notice')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'notice' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <FileText className="w-4 h-4" /> Notice
            </button>
            <button 
              onClick={() => setActiveTab('countdown')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'countdown' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Timer className="w-4 h-4" /> Countdowns
            </button>
            <button 
              onClick={() => setActiveTab('challenge')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'challenge' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              <Timer className="w-4 h-4" /> Challenges
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto relative p-6">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors z-10">
            <X className="w-5 h-5" />
          </button>
          
          {activeTab === 'users' && (
            <div className="space-y-6 max-w-2xl mx-auto pt-6 md:pt-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">User Management</h3>
              
              {loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">Loading users...</div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <button onClick={() => setShowAllUsers(false)} className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${!showAllUsers ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}><Users className="w-4 h-4" /> Active Users ({allAppUsers.length})</button>
                      <button onClick={() => setShowAllUsers(true)} className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${showAllUsers ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}><Users className="w-4 h-4" /> All Users ({allFirebaseUsers.length})</button>
                    </div>
                    {(showAllUsers ? allFirebaseUsers : allAppUsers).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">No users found.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg max-h-60 overflow-y-auto w-full relative">
                        {(showAllUsers ? allFirebaseUsers : allAppUsers).map(user => (
                          <li key={user.userId} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors">
                            <div className="flex items-center gap-3">
                              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.displayName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email || user.userId}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleUpdateUserStatus(user.userId, { isMuted: true })}
                                className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/50 dark:hover:text-amber-400 rounded-md transition-colors flex items-center gap-1"
                              >
                                Mute
                              </button>
                              <button 
                                onClick={() => handleUpdateUserStatus(user.userId, { isBanned: true })}
                                className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 rounded-md transition-colors flex items-center gap-1"
                              >
                                Ban
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-1.5"><UserX className="w-4 h-4" /> Banned Users ({bannedUsers.length})</h4>
                    {bannedUsers.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">No banned users.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg max-h-60 overflow-y-auto w-full relative">
                        {bannedUsers.map(user => (
                          <li key={user.userId} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors">
                            <div className="flex items-center gap-3">
                              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.displayName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email || user.userId}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleUpdateUserStatus(user.userId, { isBanned: false })}
                              className="text-xs font-medium px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition-colors flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Unban
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                     <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5"><MessageSquareOff className="w-4 h-4" /> Muted Users ({mutedUsers.length})</h4>
                     {mutedUsers.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">No muted users.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg max-h-60 overflow-y-auto w-full relative">
                        {mutedUsers.map(user => (
                          <li key={user.userId} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors">
                             <div className="flex items-center gap-3">
                              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.displayName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email || user.userId}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleUpdateUserStatus(user.userId, { isMuted: false })}
                              className="text-xs font-medium px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-md transition-colors flex items-center gap-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Unmute
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'liveMock' && (
            <div className="space-y-6 max-w-2xl mx-auto mt-6">
               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                 <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2"><Radio className="w-5 h-5" /> Host a Live Mock</h3>
                 
                 <div className="flex flex-col items-end gap-2">
                   <div>
                     <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        id="adminFileUpload"
                        onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="adminFileUpload" 
                        className={`text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${isProcessingImage ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'}`}
                      >
                       {isProcessingImage ? 'Analyzing...' : 'Auto-fill from image'}
                     </label>
                   </div>
                 </div>
               </div>
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-1.5 xl:col-span-1">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Exam Header</label>
                    <div className="grid grid-cols-2 gap-3">
                      {!isCustomExam ? (
                        <CustomDropdown
                          value={liveMockData.examType || ''}
                          placeholder="Exam"
                          options={EXAMS}
                          allowCustom
                          onChange={(val) => {
                            if (val === 'Other') { setIsCustomExam(true); setLiveMockData(p => ({ ...p, examType: '' })); }
                            else { setLiveMockData(p => ({ ...p, examType: val })); }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input type="search" value={liveMockData.examType} onChange={e => setLiveMockData(p => ({ ...p, examType: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm" placeholder="Custom Exam" autoFocus />
                          <button type="button" onClick={() => setIsCustomExam(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"><X className="w-4 h-4"/></button>
                        </div>
                      )}
                      {!isCustomRole ? (
                        <CustomDropdown
                          value={liveMockData.examRole || ''}
                          placeholder="Role"
                          options={ROLES}
                          allowCustom
                          onChange={(val) => {
                            if (val === 'Other') { setIsCustomRole(true); setLiveMockData(p => ({ ...p, examRole: '' })); }
                            else { setLiveMockData(p => ({ ...p, examRole: val })); }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input type="search" value={liveMockData.examRole} onChange={e => setLiveMockData(p => ({ ...p, examRole: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm" placeholder="Custom Role" autoFocus />
                          <button type="button" onClick={() => setIsCustomRole(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"><X className="w-4 h-4"/></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 xl:col-span-1 flex flex-col justify-end">
                    <div className="grid grid-cols-2 gap-3">
                      {!isCustomPhase ? (
                        <CustomDropdown
                          value={liveMockData.examPhase || ''}
                          placeholder="Phase"
                          options={PHASES}
                          allowCustom
                          onChange={(val) => {
                            if (val === 'Other') { setIsCustomPhase(true); setLiveMockData(p => ({ ...p, examPhase: '' })); }
                            else { setLiveMockData(p => ({ ...p, examPhase: val })); }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input type="search" value={liveMockData.examPhase} onChange={e => setLiveMockData(p => ({ ...p, examPhase: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm" placeholder="Custom Phase" autoFocus />
                          <button type="button" onClick={() => setIsCustomPhase(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"><X className="w-4 h-4"/></button>
                        </div>
                      )}
                      <CustomDropdown
                        value={liveMockData.examScope || ''}
                        placeholder="Scope"
                        options={SCOPES}
                        onChange={(val) => setLiveMockData(p => ({ ...p, examScope: val }))}
                      />
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mock Name</label>
                    <input type="search" value={liveMockData.mockName} onChange={e => setLiveMockData(p => ({ ...p, mockName: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. Test 1" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform</label>
                    {!isCustomPlatform ? (
                      <CustomDropdown
                        value={liveMockData.platform || ''}
                        placeholder="Platform"
                        options={PLATFORMS}
                        allowCustom
                        onChange={(val) => {
                          if (val === 'Other') { setIsCustomPlatform(true); setLiveMockData(p => ({ ...p, platform: '' })); }
                          else { setLiveMockData(p => ({ ...p, platform: val })); }
                        }}
                      />
                    ) : (
                      <div className="relative">
                        <input type="search" value={liveMockData.platform} onChange={e => setLiveMockData(p => ({ ...p, platform: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Custom Platform" autoFocus />
                        <button type="button" onClick={() => setIsCustomPlatform(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"><X className="w-4 h-4"/></button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date & Time</label>
                    <input type="datetime-local" value={liveMockData.date} onChange={e => setLiveMockData(p => ({ ...p, date: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm" />
                  </div>
               </div>
               
               <button onClick={saveLiveMock} disabled={savingAnnouncement} className="mt-4 w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                 <Save className="w-4 h-4 mr-2" /> {savingAnnouncement ? 'Publishing...' : 'Publish Live Mock'}
               </button>

               {liveMocks.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Active Live Mocks</h4>
                   <ul className="space-y-3">
                     {liveMocks.map(m => (
                       <li key={m.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between">
                         <div>
                           <p className="font-medium text-slate-900 dark:text-slate-100">{m.title}</p>
                           <p className="text-sm text-slate-500 dark:text-slate-400">{m.examType} {m.examRole} • {m.platform}</p>
                         </div>
                         <div className="flex gap-2 items-center">
                            <button onClick={() => handleEditLiveMock(m)} className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">Edit</button>
                            <button onClick={() => deleteLiveMock(m.id)} className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2"><X className="w-4 h-4" /></button>
                         </div>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'countdown' && (
            <div className="space-y-6 max-w-2xl mx-auto mt-6 relative">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                 <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Manage Countdowns</h3>
               </div>
              <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Exam / Event Name</label>
                   <input type="search" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="x-dummy" spellCheck="false" value={countdownTitle} onChange={e => setCountdownTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" placeholder="e.g. IBPS PO Prelims" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date & Time</label>
                   <input type="datetime-local" value={countdownDate} onChange={e => setCountdownDate(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Short Note (Optional)</label>
                   <input type="search" autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="x-dummy" spellCheck="false" value={countdownNote} onChange={e => setCountdownNote(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. Admit cards out soon!" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Theme Color</label>
                   <CustomDropdown
                     value={countdownColor === 'green' ? 'Green' : 
                            countdownColor === 'light-green' ? 'Light Green' :
                            countdownColor === 'orange' ? 'Orange' :
                            countdownColor === 'light-red' ? 'Light Red' :
                            countdownColor === 'red' ? 'Red' : 'Green'}
                     options={['Green', 'Light Green', 'Orange', 'Light Red', 'Red']}
                     placeholder="Select Theme Color"
                     onChange={(val) => {
                       const mapped = val === 'Light Green' ? 'light-green' :
                                      val === 'Light Red' ? 'light-red' :
                                      val.toLowerCase();
                       setCountdownColor(mapped);
                     }}
                   />
                 </div>
                 <button onClick={saveCountdown} disabled={savingAnnouncement} className="w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors">
                   <Save className="w-4 h-4 mr-2" /> {savingAnnouncement ? 'Saving...' : 'Save Countdown'}
                 </button>
              </div>

               {countdowns.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Active Countdowns</h4>
                   <ul className="space-y-3">
                     {countdowns.map(c => (
                       <li key={c.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between">
                         <div>
                           <p className="font-medium text-slate-900 dark:text-slate-100">{c.title}</p>
                           <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(c.date).toLocaleString()} {c.note && `- ${c.note}`}</p>
                         </div>
                         <div className="flex gap-2 items-center">
                            <button onClick={() => handleEditCountdown(c)} className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">Edit</button>
                            <button onClick={() => deleteCountdown(c.id)} className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2"><X className="w-4 h-4" /></button>
                         </div>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'notice' && (
            <div className="space-y-6 max-w-2xl mx-auto mt-6 relative">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                 <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Broadcast Notice</h3>
               </div>
              <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                   <input type="search" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. Server Maintenance" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Markdown supported)</label>
                   <textarea rows={4} value={noticeDescription} onChange={e => setNoticeDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Type notice details here... Use **bold**, *italic*, [links](https://...), and #hashtags within text." />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urgency (Optional)</label>
                     <CustomDropdown 
                        value={noticeUrgency === 'info' ? 'Info (Blue)' : noticeUrgency === 'warning' ? 'Warning (Yellow)' : noticeUrgency === 'error' ? 'Urgent (Red)' : 'None (Default)'}
                        options={['None (Default)', 'Info (Blue)', 'Warning (Yellow)', 'Urgent (Red)']}
                        onChange={(val) => {
                          if (val === 'Info (Blue)') setNoticeUrgency('info');
                          else if (val === 'Warning (Yellow)') setNoticeUrgency('warning');
                          else if (val === 'Urgent (Red)') setNoticeUrgency('error');
                          else setNoticeUrgency('');
                        }}
                        placeholder="Select Urgency"
                      />
                    </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Global Tags (comma separated)</label>
                     <input type="text" value={noticeTags} onChange={e => setNoticeTags(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. maintenance, update" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Action Link (Optional)</label>
                   <input type="url" value={noticeLink} onChange={e => setNoticeLink(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="https://..." />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Live Until (Optional)</label>
                   <input type="datetime-local" value={noticeDate} onChange={e => setNoticeDate(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" />
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl mt-2">
                   <div className="flex flex-col">
                     <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Users can edit</span>
                     <span className="text-xs text-slate-500 dark:text-slate-400">Allow users to edit this notice from the home screen</span>
                   </div>
                   <button
                     type="button"
                     onClick={() => setNoticeEditableBy(prev => prev === 'admin' ? 'users' : 'admin')}
                     className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${noticeEditableBy === 'users' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'} `}
                   >
                     <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${noticeEditableBy === 'users' ? 'translate-x-5' : 'translate-x-0'}`} />
                   </button>
                 </div>
                 <button onClick={saveNotice} disabled={savingAnnouncement} className="w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors">
                   <Save className="w-4 h-4 mr-2" /> {savingAnnouncement ? 'Publishing...' : 'Publish Notice'}
                 </button>
              </div>

               {notices.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Active Notices</h4>
                   <ul className="space-y-3">
                     {notices.map(n => (
                       <li key={n.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between">
                         <div>
                           <p className="font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                           {n.description && <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{n.description}</p>}
                         </div>
                         <div className="flex gap-2 items-center">
                            <button onClick={() => handleEditNotice(n)} className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">Edit</button>
                            <button onClick={() => deleteNotice(n.id)} className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2"><X className="w-4 h-4" /></button>
                         </div>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'challenge' && (
            <div className="space-y-6 max-w-2xl mx-auto mt-6 relative">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                 <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Manage Challenges</h3>
               </div>
              <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Challenge Title</label>
                   <input type="search" value={challengeTitle} onChange={e => setChallengeTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" placeholder="e.g. 50 Days Mock Challenge" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                   <textarea rows={3} value={challengeDescription} onChange={e => setChallengeDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" placeholder="e.g. Can you maintain a mock streak for 50 days?" />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Challenge Type</label>
                     <CustomDropdown 
                       value={challengeType === 'streak' ? 'Check-in' : challengeType === 'uploadMock' ? 'Upload Mock' : 'To-Do'}
                       options={['Check-in', 'Upload Mock', 'To-Do']}
                       onChange={(val) => setChallengeType(val === 'Check-in' ? 'streak' : val === 'Upload Mock' ? 'uploadMock' : 'todo')}
                       placeholder="Select Type"
                     />
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                     <input type="date" value={challengeStartDate} onChange={e => {
                       const newStart = e.target.value;
                       setChallengeStartDate(newStart);
                       if (newStart && challengeDuration) {
                         const d = new Date(newStart);
                         d.setDate(d.getDate() + parseInt(challengeDuration));
                         setChallengeEndDate(d.toISOString().split('T')[0]);
                       } else if (newStart && challengeEndDate) {
                         const start = new Date(newStart).getTime();
                         const end = new Date(challengeEndDate).getTime();
                         if (end > start) {
                           setChallengeDuration(Math.ceil((end - start) / (1000 * 60 * 60 * 24)).toString());
                         }
                       }
                     }} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration</label>
                     <input type="number" placeholder="Days" value={challengeDuration} onChange={e => {
                       const newDuration = e.target.value;
                       setChallengeDuration(newDuration);
                       if (newDuration && challengeStartDate) {
                         const d = new Date(challengeStartDate);
                         d.setDate(d.getDate() + parseInt(newDuration));
                         setChallengeEndDate(d.toISOString().split('T')[0]);
                       }
                     }} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                     <input type="date" value={challengeEndDate} onChange={e => {
                       const newEnd = e.target.value;
                       setChallengeEndDate(newEnd);
                       if (newEnd && challengeStartDate) {
                         const start = new Date(challengeStartDate).getTime();
                         const end = new Date(newEnd).getTime();
                         if (end > start) {
                           setChallengeDuration(Math.ceil((end - start) / (1000 * 60 * 60 * 24)).toString());
                         }
                       }
                     }} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" />
                   </div>
                 </div>
                 {/* Challenge Tasks configuration for all types */}
                 <div className="space-y-4 mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Challenge Tasks <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                        {challengeTasks.length > 0 && (
                          <button 
                             type="button"
                             onClick={() => setChallengeTodoFrequency(prev => prev === 'oneTime' ? 'daily' : 'oneTime')}
                             className="py-1 px-2.5 text-[10px] font-bold rounded overflow-hidden bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                             title={challengeTodoFrequency === 'oneTime' ? 'Check each task only once.' : 'Tasks renew daily.'}
                           >
                            {challengeTodoFrequency === 'oneTime' ? 'Once' : 'Daily'}
                           </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                        {challengeTasks.map((t, idx) => (
                          <div key={t.id} className="flex items-center gap-2">
                            <input type="text" value={t.text} onChange={(e) => {
                              const newTasks = [...challengeTasks];
                              newTasks[idx].text = e.target.value;
                              setChallengeTasks(newTasks);
                            }} className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm bg-slate-50 dark:bg-slate-900/50 dark:text-slate-200" placeholder="Task description..." />
                            <button onClick={() => setChallengeTasks(challengeTasks.filter(item => item.id !== t.id))} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setChallengeTasks([...challengeTasks, { id: Math.random().toString(36).substring(2,9), text: '' }])} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-2 flex items-center gap-1">+ Add Task</button>
                    </div>
                 </div>
                 <button onClick={saveChallenge} disabled={savingAnnouncement} className="w-full justify-center inline-flex items-center px-4 py-3 mt-4 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors">
                   <Save className="w-4 h-4 mr-2" /> {savingAnnouncement ? 'Saving...' : 'Save Challenge'}
                 </button>
              </div>

               {challenges.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Active Challenges</h4>
                   <ul className="space-y-3">
                     {challenges.map(c => (
                       <li key={c.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between">
                         <div>
                           <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                             {c.title}
                             {c.approvalStatus === 'pending' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Pending</span>}
                             {c.approvalStatus === 'rejected' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Rejected</span>}
                           </p>
                           <p className="text-sm text-slate-500 dark:text-slate-400">{c.durationDays} Days • {c.challengeType}</p>
                         </div>
                         <div className="flex gap-2 items-center">
                            <button onClick={() => handleEditChallenge(c)} className="text-sm text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">Edit</button>
                            <button onClick={() => deleteChallenge(c.id)} className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2"><X className="w-4 h-4" /></button>
                         </div>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
