import React, { useState, useEffect, useLayoutEffect, useContext } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { AppProvider, UserProfileCtx, SystemDataCtx, AppStateCtx } from './context/AppContext';
import { useUIStore } from './store/uiStore';
import { useMocks } from './hooks/useMocks';
import { useAuth } from './services/AuthContext';
import { useThemeManager } from './hooks/useThemeManager';
import { AuthView } from './components/views/AuthView';
import { CountdownsSection } from './components/views/CountdownsSection';
import { NoticesSection } from './components/views/NoticesSection';
import { ChallengesSection } from './components/views/ChallengesSection';
import { LiveMocksSection } from './components/views/LiveMocksSection';
import { ModalsSection } from './components/views/ModalsSection';
import { DatabaseZap } from 'lucide-react';
import Navigation from './components/Navigation';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/views/HomeView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ViewManager } from './components/ViewManager';
import UpdateChangelogModal from './components/UpdateChangelogModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';
import { useVersionStore } from './store/versionStore';

function AppContent() {
  const { activeTab, setActiveTab, adminTab, isAdminModalOpen, theme, setTheme, mockToEdit, setMockToEdit } = useUIStore();
  const { user, loading, logout } = useAuth();
  const { profile } = useContext(UserProfileCtx)!;
  const { addMock, updateMock, loading: mocksLoading } = useMocks();
  const { selectedCategory, categories, fetchAnnouncement } = useContext(SystemDataCtx)!;
  const { isOwner, isAdmin, adminPermissions } = useContext(AppStateCtx)!;

  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  const [isGoingDown, setIsGoingDown] = useState(true);
  const contentAnimation = useAnimation();
  
  const isAppReady = !loading && (!user || !!profile);

  // Sync latest release version pointer in real-time
  useEffect(() => {
    const releaseDocRef = doc(db, 'metadata', 'release');
    const unsubscribe = onSnapshot(releaseDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.latestVersion) {
          useVersionStore.getState().setLatestCloudVersion(data.latestVersion);
        }
      }
    }, (error) => {
      console.warn("Could not subscribe to release metadata dynamically", error);
    });
    return () => unsubscribe();
  }, []);

  useLayoutEffect(() => {
     if (!isAppReady) return;
     
     // Stop any currently running animation
     contentAnimation.stop();
     // Instantly snap to the starting position
     contentAnimation.set("initial");
     
     let frame1: number;
     let frame2: number;
     
     // Double requestAnimationFrame ensures the browser has painted 
     // the initial DOM before starting the GPU animation, eliminating stutter
     frame1 = requestAnimationFrame(() => {
       frame2 = requestAnimationFrame(() => {
         contentAnimation.start("animate");
       });
     });
     
     return () => {
       cancelAnimationFrame(frame1);
       cancelAnimationFrame(frame2);
     };
  }, [activeTab, contentAnimation, isGoingDown, isAppReady]);

  if (activeTab !== prevActiveTab) {
    const tabOrder = ['home', 'dashboard', 'countdowns', 'tasks', 'add-mock', 'admin', 'community', 'profile'];
    const oldIndex = tabOrder.indexOf(prevActiveTab);
    const newIndex = tabOrder.indexOf(activeTab);
    setPrevActiveTab(activeTab);
    setIsGoingDown(newIndex > oldIndex);
  }

  useThemeManager(theme);

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
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[#0f172a] font-sans text-slate-900 dark:text-slate-200 transition-colors duration-0">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div className={`sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 ${!user ? '' : 'md:hidden'}`}>
          <Navigation />
        </div>
        
        {/* Main Layout */}
        <main className={`flex-1 ${['admin', 'profile', 'countdowns'].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto'} px-[15px] sm:px-6 lg:px-8 py-8 pt-6 pb-24 md:pb-8 w-full flex flex-col min-h-0`}>
            <motion.div 
              custom={isGoingDown}
              variants={{
                initial: (direction: boolean) => ({ x: direction ? 6 : -6, opacity: 0 }),
                animate: { x: 0, opacity: 1 }
              }}
              initial="initial"
              animate={contentAnimation}
              transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
              style={{ willChange: "transform, opacity" }}
              className={`max-w-full mx-auto w-full ${['admin', 'profile', 'countdowns'].includes(activeTab) ? 'h-full min-h-0' : ''} flex flex-col`}
            >
              {!user ? (
              <AuthView />
            ) : mocksLoading ? (
               <div className="flex flex-col items-center justify-center min-h-[60vh]">
                 <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
            ) : (
              <>
                {['home'].includes(activeTab) && (
                  <HomeView />
                )}
                {['dashboard', 'community'].includes(activeTab) && (
                  <>
                    <CountdownsSection />
                    <NoticesSection />
                    <ChallengesSection />
                    <LiveMocksSection />
                  </>
                )}

            <ViewManager />
          </>
        )}
            </motion.div>
        </main>

        <BottomNav />
        <ModalsSection />
        <UpdateChangelogModal />
      </div>
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
