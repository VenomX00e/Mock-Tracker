import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Dashboard from './components/Dashboard';
import CommunityHub from './components/CommunityHub';
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

function AppContent() {
  const { activeTab, adminTab, adminEditNotice, adminEditCountdown, isAdminModalOpen, darkMode } = useUIStore();
  const { user, loading, logout } = useAuth();
  const { profile } = useContext(UserProfileCtx)!;
  const { loading: mocksLoading } = useMocks();
  const { selectedCategory, categories, fetchAnnouncement } = useContext(SystemDataCtx)!;
  const { isOwner, isAdmin, adminPermissions } = useContext(AppStateCtx)!;

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] font-sans text-slate-900 dark:text-slate-200 pb-[45px] pl-[0px] transition-colors duration-200">
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
            <CountdownsSection />
            <NoticesSection />
            <ChallengesSection />
            <LiveMocksSection />

            <section className="w-full">
              <motion.div
                 key={activeTab}
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ duration: 0.2 }}
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
                  ) : activeTab === 'dashboard' ? (
                    <Dashboard />
                  ) : (
                    <CommunityHub />
                  )}
                </motion.div>
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
      <SpeedInsights />
    </ErrorBoundary>
  );
}
