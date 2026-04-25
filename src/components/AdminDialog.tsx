import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../types';
import { Shield, UserX, UserCheck, MessageSquareOff, MessageSquare, AlertCircle, Save, X, Radio, FileText, Users, Calendar } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { EXAMS, ROLES, PHASES, SCOPES, PLATFORMS } from '../lib/constants';
import { parseMockAnnouncementImage } from '../services/geminiService';

interface AdminDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

import { useAuth } from '../services/AuthContext';

export default function AdminDialog({ isOpen, onClose }: AdminDialogProps) {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'liveMock' | 'notice'>('users');
  const [bannedUsers, setBannedUsers] = useState<UserProfile[]>([]);
  const [mutedUsers, setMutedUsers] = useState<UserProfile[]>([]);
  const [allAppUsers, setAllAppUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Live mock & notice inputs
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDescription, setNoticeDescription] = useState('');
  const [noticeLink, setNoticeLink] = useState('');
  
  // Custom states for Live Mock
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);

  const [liveMockData, setLiveMockData] = useState({
    examType: '',
    examRole: '',
    examPhase: 'Prelims',
    examScope: 'Full',
    mockName: '',
    platform: '',
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  });

  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

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
      setAllAppUsers(allUsers.filter(u => !u.isBanned && !u.isMuted && u.userId !== currentUser?.uid));
    } catch (error) {
      console.error("Error fetching users", error);
    }
    setLoading(false);
  };

  const [liveMocks, setLiveMocks] = useState<any[]>([]);

  const [notices, setNotices] = useState<any[]>([]);

  const fetchAnnouncement = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'system')));
      const tempMocks: any[] = [];
      const tempNotices: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.type === 'notice') {
          tempNotices.push({ id: d.id, ...data });
        } else if (data.type === 'liveMock') {
          tempMocks.push({ id: d.id, ...data });
        }
      });
      setLiveMocks(tempMocks);
      setNotices(tempNotices);
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
      const newId = `notice_${Date.now()}`;
      await setDoc(doc(db, 'system', newId), {
        type: 'notice',
        title: noticeTitle,
        description: noticeDescription,
        link: noticeLink,
        updatedAt: new Date().toISOString()
      }, { merge: false });
      alert("Notice saved successfully");
      setNoticeTitle('');
      setNoticeDescription('');
      setNoticeLink('');
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving notice", error);
      alert("Failed to save notice");
    }
    setSavingAnnouncement(false);
  };

  const saveLiveMock = async () => {
    setSavingAnnouncement(true);
    try {
      if (!liveMockData.mockName || !liveMockData.examType) {
        alert("Mock Name and Exam Type are required.");
        setSavingAnnouncement(false);
        return;
      }
      const newId = `liveMock_${Date.now()}`;
      await setDoc(doc(db, 'system', newId), {
        type: 'liveMock',
        ...liveMockData,
        title: `Live: ${liveMockData.mockName}`,
        description: `Join the community in taking the ${liveMockData.examType} ${liveMockData.examRole} ${liveMockData.examPhase} mock on ${liveMockData.platform || 'any platform'}.`,
        link: '',
        updatedAt: new Date().toISOString()
      }, { merge: false });
      alert("Live Mock saved successfully");
      fetchAnnouncement();
    } catch (error) {
      console.error("Error saving live mock", error);
      alert("Failed to save live mock");
    }
    setSavingAnnouncement(false);
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
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto relative p-6 pr-14">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10">
            <X className="w-5 h-5" />
          </button>
          
          {activeTab === 'users' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">User Management</h3>
              
              {loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">Loading users...</div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5"><Users className="w-4 h-4" /> Active Users ({allAppUsers.length})</h4>
                    {allAppUsers.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">No active users.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg max-h-60 overflow-y-auto w-full relative">
                        {allAppUsers.map(user => (
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
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
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
                          <input type="text" value={liveMockData.examType} onChange={e => setLiveMockData(p => ({ ...p, examType: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm" placeholder="Custom Exam" autoFocus />
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
                          <input type="text" value={liveMockData.examRole} onChange={e => setLiveMockData(p => ({ ...p, examRole: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm" placeholder="Custom Role" autoFocus />
                          <button type="button" onClick={() => setIsCustomRole(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-200"><X className="w-4 h-4"/></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-2 flex flex-col justify-end">
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
                          <input type="text" value={liveMockData.examPhase} onChange={e => setLiveMockData(p => ({ ...p, examPhase: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm" placeholder="Custom Phase" autoFocus />
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
                    <input type="text" value={liveMockData.mockName} onChange={e => setLiveMockData(p => ({ ...p, mockName: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. Test 1" />
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
                        <input type="text" value={liveMockData.platform} onChange={e => setLiveMockData(p => ({ ...p, platform: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Custom Platform" autoFocus />
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
                         <button onClick={() => deleteLiveMock(m.id)} className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2"><X className="w-4 h-4" /></button>
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
                   <input type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="e.g. Server Maintenance" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                   <textarea rows={4} value={noticeDescription} onChange={e => setNoticeDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="Type notice details here..." />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Action Link (Optional)</label>
                   <input type="url" value={noticeLink} onChange={e => setNoticeLink(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="https://..." />
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
                           {n.description && <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{n.description}</p>}
                         </div>
                         <button onClick={() => deleteNotice(n.id)} className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2"><X className="w-4 h-4" /></button>
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
