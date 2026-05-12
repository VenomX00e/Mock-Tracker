import React from 'react';
import { Shield, LayoutDashboard, Users, Plus, LogIn, Sun, Moon } from 'lucide-react';
import { useAuthCtx, useUserProfileCtx, useAppStateCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';

export default function Navigation() {
  const { user, signInWithGoogle } = useAuthCtx();
  const { profile } = useUserProfileCtx();
  const { isOwner, isAdmin, adminPermissions } = useAppStateCtx();
  const {
      activeTab,
      setActiveTab,
      setIsApiModalOpen,
      setIsAddModalOpen,
      setAdminTab,
      setAdminEditNotice,
      setAdminEditCountdown,
      setIsAdminModalOpen,
      setIsProfileModalOpen,
      darkMode,
      setDarkMode
  } = useUIStore();

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsApiModalOpen(true)} title="Configure API Key">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img src="/icon-192.svg" alt="MockTracker" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg sm:text-[21px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 group-hover:from-blue-800 group-hover:to-indigo-800 transition-colors" style={{ marginLeft: '-7px', paddingLeft: '0px', paddingRight: '5px' }}>
              MockTracker
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                  <div className="flex items-center gap-1 lg:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {isOwner && (
                      <button
                        onClick={() => { setActiveTab('admin'); window.scrollTo(0, 0); }}
                        className={`p-1.5 rounded-lg transition-colors ${activeTab === 'admin' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                        title="Control Panel"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { setActiveTab('dashboard'); window.scrollTo(0, 0); }}
                      className={`p-1.5 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                      title="My Mocks"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setActiveTab('community'); window.scrollTo(0, 0); }}
                      className={`p-1.5 rounded-lg transition-colors ${activeTab === 'community' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                      title="Community"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Desktop Tabs */}
                  <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl relative">
                    {isOwner && (
                      <button
                        onClick={() => { setActiveTab('admin'); window.scrollTo(0, 0); }}
                        className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 flex items-center gap-1.5 ${
                          activeTab === 'admin' 
                            ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        <span className="relative z-10 block pointer-events-none">Control Panel</span>
                      </button>
                    )}
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

                {!isOwner && isAdmin && (
                  <button
                    onClick={() => {
                      let firstTab: any = 'users';
                      if (adminPermissions?.canManageUsers) firstTab = 'users';
                      else if (adminPermissions?.canManageLiveMocks) firstTab = 'liveMock';
                      else if (adminPermissions?.canManageNotices) firstTab = 'notice';
                      else if (adminPermissions?.canManageCountdowns) firstTab = 'countdown';
                      else if (adminPermissions?.canManageChallenges) firstTab = 'challenge';
                      else if (adminPermissions?.canManageSettings) firstTab = 'settings';
                      else firstTab = '';
                      
                      setAdminTab(firstTab);
                      setAdminEditNotice(null);
                      setAdminEditCountdown(null);
                      setIsAdminModalOpen(true);
                     }}
                    className="p-1.5 md:p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent rounded-lg transition-colors"
                    title="Control Panel"
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
  );
}
