import React from "react";
import {
  Shield,
  LayoutDashboard,
  Users,
  Plus,
  LogIn,
  Sun,
  Moon,
  Download,
  Gamepad2,
  CheckSquare,
} from "lucide-react";
import {
  useAuthCtx,
  useUserProfileCtx,
  useAppStateCtx,
} from "../context/AppContext";
import { useUIStore } from "../store/uiStore";
import { usePwaInstall } from "../hooks/usePwaInstall";

export default function Navigation() {
  const { user, signInWithGoogle } = useAuthCtx();
  const { profile } = useUserProfileCtx();
  const { isOwner, isAdmin, adminPermissions, setMockToEdit } =
    useAppStateCtx();
  const { isInstallable, installApp } = usePwaInstall();
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
    theme,
    setTheme,
  } = useUIStore();

  return (
    <header className="w-full relative z-40 transition-colors duration-0 py-2 sm:py-4">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12 sm:h-14">
          <div className="flex items-center gap-3 md:hidden group cursor-pointer" onClick={() => setIsApiModalOpen(true)}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img src="/icon-192.svg" alt="MockTracker" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg sm:text-[21px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400">
              MockTracker
            </h1>
          </div>
          
          <div className="hidden md:block flex-1"></div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {user ? (
              <>
                {isInstallable && (
                  <button
                    onClick={installApp}
                    className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-full transition-colors backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 hidden sm:flex"
                    title="Install App"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                {(isOwner || isAdmin) && (
                  <button
                    className="p-1.5 sm:p-2 text-slate-500 md:hidden hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-white/50 hover:bg-indigo-50 dark:bg-slate-800/50 dark:hover:bg-indigo-900/40 rounded-full transition-colors backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 flex"
                    title="Control Panel"
                    onClick={() => {
                      let firstTab: any = "users";
                      if (adminPermissions?.canManageUsers) firstTab = "users";
                      else if (adminPermissions?.canManageLiveMocks) firstTab = "liveMock";
                      else if (adminPermissions?.canManageNotices) firstTab = "notice";
                      else if (adminPermissions?.canManageCountdowns) firstTab = "countdown";
                      else if (adminPermissions?.canManageChallenges) firstTab = "challenge";
                      else if (adminPermissions?.canManageSettings) firstTab = "settings";
                      else firstTab = "";

                      setAdminTab(firstTab);
                      setAdminEditNotice(null);
                      setAdminEditCountdown(null);
                      setActiveTab("admin");
                      window.scrollTo(0, 0);
                    }}
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                <button
                  className="flex items-center justify-center cursor-pointer hover:ring-2 ring-indigo-500/50 hover:shadow-md transition-all rounded-full bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/50 overflow-hidden"
                  onClick={() => {
                    setActiveTab("profile");
                    window.scrollTo(0, 0);
                  }}
                >
                  <img
                    src={
                      profile?.photoURL ||
                      user.photoURL ||
                      `https://ui-avatars.com/api/?name=${user.displayName}`
                    }
                    alt="Profile"
                    className="w-8 h-8 sm:w-10 sm:h-10 object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={signInWithGoogle}
                  className="inline-flex flex-nowrap whitespace-nowrap items-center justify-center px-4 sm:px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm neon-action-btn"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  <span>Sign In</span>
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </header>
  );
}
