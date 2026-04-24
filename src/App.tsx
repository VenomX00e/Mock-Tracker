import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AddMockDialog from './components/AddMockDialog';
import ProfileDialog from './components/ProfileDialog';
import CommunityHub from './components/CommunityHub';
import AdminDialog from './components/AdminDialog';
import { useMocks } from './hooks/useMocks';
import { useAuth } from './services/AuthContext';
import { useUserProfile } from './hooks/useUserProfile';
import { MockScore } from './types';
import { Plus, Target, LayoutDashboard, DatabaseZap, LogOut, LogIn, Shield, Megaphone, ArrowRight, X } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from './services/firebase';

import { PublicProfileDialog } from './components/PublicProfileDialog';

export default function App() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const { profile } = useUserProfile();
  const { mocks, loading: mocksLoading, addMock, updateMock, deleteMock } = useMocks();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activePublicProfile, setActivePublicProfile] = useState<any>(null);
  const [mockToEdit, setMockToEdit] = useState<MockScore | undefined>(undefined);
  const [lastDeletedMock, setLastDeletedMock] = useState<MockScore | null>(null);
  
  // Admin & Announcement states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('geminiApiKey') || '');
  const [notices, setNotices] = useState<any[]>([]);
  const [liveMocks, setLiveMocks] = useState<any[]>([]);
  const [dismissedLiveMocks, setDismissedLiveMocks] = useState<string[]>(JSON.parse(localStorage.getItem('dismissedLiveMocks') || '[]'));

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
          let mocks: any[] = [];
          snap.forEach(d => {
            const data = d.data();
            if (data.type === 'notice') {
              activeNotices.push({ id: d.id, ...data });
            } else if (data.type === 'liveMock') {
              mocks.push({ id: d.id, ...data });
            }
          });
          setNotices(activeNotices);
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

  const handleEditMock = (mock: MockScore) => {
    setMockToEdit(mock);
    setIsAddModalOpen(true);
  };

  const handleDeleteMock = (id: string) => {
    const mockToDelete = mocks.find(m => m.id === id);
    if (mockToDelete) {
      setLastDeletedMock(mockToDelete);
      deleteMock(id);
      
      setTimeout(() => {
        setLastDeletedMock(current => current?.id === mockToDelete.id ? null : current);
      }, 15000);
    }
  };

  const handleRestoreMock = () => {
    if (lastDeletedMock) {
      addMock(lastDeletedMock);
      setLastDeletedMock(null);
    }
  };

  const handleCopyMock = (mock: MockScore) => {
    // Copy the details but remove the ID so it's treated as a new entry
    const copiedMock = { ...mock, id: '', score: 0, percentile: 0, percentage: 0, quant: { score: 0, percentile: 0 }, reasoning: { score: 0, percentile: 0 }, english: { score: 0, percentile: 0 }};
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsApiModalOpen(true)}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:bg-blue-700 transition-colors">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 group-hover:from-blue-800 group-hover:to-indigo-800 transition-colors">
                Bank Exam Mock Tracker
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div 
                    className="hidden sm:flex items-center gap-2 mr-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    onClick={() => setIsProfileModalOpen(true)}
                  >
                    <span className="text-sm font-semibold text-slate-700">{profile?.displayName || user.displayName}</span>
                    <img src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setIsAdminModalOpen(true)}
                      className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-100 rounded-lg transition-colors mr-2"
                      title="Admin Dashboard"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <Plus className="w-4 h-4 text-white sm:mr-1.5" />
                    <span className="hidden sm:inline">Add Mock</span>
                  </button>
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
            {/* Notices */}
            {notices.map((n) => (
              <div key={n.id} className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border border-amber-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                  <Megaphone className="w-32 h-32 text-amber-900" />
                </div>
                <div className="relative z-10 max-w-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-200 text-amber-800">Notice</span>
                      <h2 className="text-xl font-bold text-slate-900">{n.title}</h2>
                    </div>
                    {n.description && (
                      <p className="text-slate-700 text-sm leading-relaxed">
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
            {liveMocks.filter(lm => !mocks.some(m => m.mockName === lm.mockName && m.examType === lm.examType) && !dismissedLiveMocks.includes(lm.id)).length > 0 ? (
               <div>
                 <div className="flex justify-between items-end mb-3">
                   <h3 className="text-lg font-bold text-slate-800">Active Live Mocks</h3>
                   {dismissedLiveMocks.length > 0 && (
                     <button onClick={restoreLiveMocks} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">Show hidden Live Mocks</button>
                   )}
                 </div>
                 <div className="mb-8 flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                   {liveMocks.filter(lm => !mocks.some(m => m.mockName === lm.mockName && m.examType === lm.examType) && !dismissedLiveMocks.includes(lm.id)).map(liveMock => (
                     <div key={liveMock.id} className="min-w-[300px] md:min-w-[400px] flex-shrink-0 p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 shadow-sm relative overflow-hidden snap-start">
                       
                       <button onClick={(e) => dismissLiveMock(liveMock.id, e)} className="absolute top-3 right-3 p-1.5 bg-white/50 hover:bg-white rounded-full text-indigo-400 hover:text-rose-500 transition-colors z-20" title="Hide Live Mock">
                         <X className="w-4 h-4" />
                       </button>

                       <div className="absolute top-0 right-0 p-4 opacity-5">
                         <Target className="w-24 h-24 text-indigo-900" />
                       </div>
                       <div className="relative z-10 flex flex-col h-full justify-between">
                       <div>
                         <div className="flex items-center gap-2 mb-2">
                           <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-600 text-white animate-pulse">Live</span>
                           <span className="text-xs font-semibold text-indigo-800">{liveMock.examType} {liveMock.examRole && liveMock.examRole}</span>
                         </div>
                         <h3 className="text-lg font-bold text-slate-900 mb-1">{liveMock.mockName}</h3>
                         <p className="text-slate-600 text-xs mb-4">{liveMock.platform || 'Any Platform'} • {liveMock.examPhase} • {liveMock.examScope}</p>
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
                {dismissedLiveMocks.length > 0 && (
                  <div className="flex justify-end mb-3">
                    <button onClick={restoreLiveMocks} className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">Show hidden Live Mocks</button>
                  </div>
                )}
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
            )}

            <section className="w-full">
              {mocksLoading ? (
                 <div className="flex justify-center p-12">
                   <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : (
                <>
                  <Dashboard 
                    mocks={mocks} 
                    profile={profile || undefined}
                    onDeleteMock={handleDeleteMock} 
                    onEditMock={handleEditMock} 
                    lastDeletedMock={lastDeletedMock}
                    onRestoreMock={handleRestoreMock}
                  />
                  
                  <CommunityHub 
                     onCopyMock={handleCopyMock} 
                     onUserClick={(u) => setActivePublicProfile(u)}
                  />
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

      {/* API Key Modal */}
      {isApiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Configure Gemini API Key</h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">To use the AI image extraction feature, paste your free Gemini API key below.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="AIzaSy..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 font-semibold text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 transition-all"
                >
                  Save Key
                </button>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <h4 className="text-sm font-bold text-blue-900 mb-1">How to get a key?</h4>
              <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                1. Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold hover:text-blue-600">Google AI Studio</a>.<br/>
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
