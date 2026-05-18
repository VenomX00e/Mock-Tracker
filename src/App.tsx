import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import CommunityHub from './components/CommunityHub';
import { TasksPage } from './components/TasksPage';
import AdminDialog from './components/AdminDialog';
import { AppProvider, UserProfileCtx, SystemDataCtx, AppStateCtx } from './context/AppContext';
import { useUIStore } from './store/uiStore';
import { useMocks } from './hooks/useMocks';
import { useAuth } from './services/AuthContext';
import { AuthView } from './components/views/AuthView';
import { CountdownsSection } from './components/views/CountdownsSection';
import { NoticesSection } from './components/views/NoticesSection';
import { ChallengesSection } from './components/views/ChallengesSection';
import { LiveMocksSection } from './components/views/LiveMocksSection';
import { ModalsSection } from './components/views/ModalsSection';
import { DatabaseZap } from 'lucide-react';
import Navigation from './components/Navigation';
import { ErrorBoundary } from './components/ErrorBoundary';

import AddMockDialog from './components/AddMockDialog';
import ProfileDialog from './components/ProfileDialog';

function AppContent() {
  const { activeTab, setActiveTab, adminTab, adminEditNotice, adminEditCountdown, isAdminModalOpen, theme, setTheme } = useUIStore();
  const { user, loading, logout } = useAuth();
  const { profile } = useContext(UserProfileCtx)!;
  const { addMock, updateMock, loading: mocksLoading } = useMocks();
  const { selectedCategory, categories, fetchAnnouncement } = useContext(SystemDataCtx)!;
  const { isOwner, isAdmin, adminPermissions, mockToEdit, setMockToEdit } = useContext(AppStateCtx)!;

  useEffect(() => {
    document.documentElement.classList.remove(
      'light', 'dark', 'cyber', 'cyber-light', 
      'cyber-green', 'cyber-green-light', 
      'cyber-lavender', 'cyber-lavender-light', 
      'cyber-pink', 'cyber-pink-light', 
      'cyber-orange', 'cyber-orange-light'
    );
    document.documentElement.classList.add(theme);
    if (theme === 'dark' || (theme.startsWith('cyber') && !theme.includes('-light'))) {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (user) {
      fetchAnnouncement();
      const interval = setInterval(fetchAnnouncement, 60000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab, isAdminModalOpen, fetchAnnouncement]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f172a]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile?.isBanned) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0f172a] p-6 text-center">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-sm border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
             <DatabaseZap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Account Banned</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">Your access to this application has been suspended by an administrator.</p>
          <button onClick={logout} className="px-6 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] font-sans text-slate-900 dark:text-slate-200 pb-[45px] pl-[0px] transition-colors duration-0">
      <Navigation />
      
      {/* Main Layout */}
      <main className="max-w-full mx-auto px-[15px] sm:px-6 lg:px-8 py-8 pt-[25px] w-full">
        {!user ? (
          <AuthView />
        ) : mocksLoading ? (
           <div className="flex flex-col items-center justify-center min-h-[60vh]">
             <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : (
          <>
            {['dashboard', 'community'].includes(activeTab) && (
              <>
                <CountdownsSection />
                <NoticesSection />
                <ChallengesSection />
                <LiveMocksSection />
              </>
            )}

            <section className="w-full">
              <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
                <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.15, ease: "easeOut" }}
                   className="w-full"
                >
                  <Dashboard />
                </motion.div>
              </div>

              {activeTab !== 'dashboard' && (
                <motion.div
                   key={activeTab}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.15, ease: "easeOut" }}
                   className="w-full"
                >
                  {activeTab === 'admin' && isAdmin ? (
                      <AdminDialog
                        isOpen={true}
                        isOwner={isOwner}
                        adminPermissions={adminPermissions}
                        currentCategory={selectedCategory}
                        asPage={true}
                        initialTab={adminTab || ((!isOwner && adminPermissions) ? (
                             adminPermissions.canManageUsers ? 'users' :
                             adminPermissions.canManageLiveMocks ? 'liveMock' :
                             adminPermissions.canManageNotices ? 'notice' :
                             adminPermissions.canManageCountdowns ? 'countdown' :
                             adminPermissions.canManageChallenges ? 'challenge' :
                             adminPermissions.canManageSettings ? 'settings' : 'users'
                        ) : 'users') as any}
                        editNoticeData={adminEditNotice}
                        editCountdownData={adminEditCountdown}
                        categories={categories}
                      />
                    ) : activeTab === 'tasks' ? (
                      <TasksPage />
                    ) : activeTab === 'add-mock' ? (
                      <AddMockDialog
                        isOpen={true}
                        asPage={true}
                        onClose={() => {
                          setActiveTab('dashboard');
                          if (mockToEdit) {
                            setTimeout(() => {
                              document.getElementById('history-log')?.scrollIntoView({ behavior: 'smooth' });
                              setMockToEdit(undefined);
                            }, 100);
                          } else {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        categories={categories}
                        initialMock={mockToEdit}
                        categoryId={selectedCategory}
                        onSave={async (mock) => {
                          if (mockToEdit?.id) {
                            await updateMock(mock);
                          } else {
                            await addMock(mock);
                          }
                          setActiveTab('dashboard');
                          if (mockToEdit) {
                            setTimeout(() => {
                              document.getElementById('history-log')?.scrollIntoView({ behavior: 'smooth' });
                              setMockToEdit(undefined);
                            }, 100);
                          } else {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                      />
                    ) : activeTab === 'profile' ? (
                      <ProfileDialog
                        isOpen={true}
                        asPage={true}
                        onClose={() => setActiveTab('dashboard')}
                        theme={theme}
                        setTheme={setTheme}
                        categories={categories}
                      />
                    ) : (
                      <CommunityHub />
                    )}
                </motion.div>
              )}
            </section>
          </>
        )}
      </main>

      <ModalsSection />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
