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
import { useVersionStore } from "../store/versionStore";

export default function Navigation() {
  const { user, signInWithGoogle } = useAuthCtx();
  const { profile } = useUserProfileCtx();
  const { isOwner, isAdmin, adminPermissions } = useAppStateCtx();
  const { setMockToEdit, setAdminEditNotice, setAdminEditCountdown } = useUIStore();
  const { isInstallable, installApp } = usePwaInstall();
  const {
    activeTab,
    setActiveTab,
    setIsApiModalOpen,
    setIsAddModalOpen,
    setAdminTab,
    setIsAdminModalOpen,
    setIsProfileModalOpen,
    theme,
    setTheme,
  } = useUIStore();

  const { hasUnreadUpdate, setUpdateModalOpen } = useVersionStore();

  return (
    <header className="w-full relative z-40 transition-colors duration-0 py-2 sm:py-2">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12">
          <div className={`flex items-center gap-3 group cursor-pointer ${!user ? '' : 'md:hidden'}`} onClick={() => setUpdateModalOpen(true)}>
            <div className="relative">
              <div className="absolute inset-0 m-auto w-6 h-6 rounded-full blur-[10px] opacity-70 scale-[1.3] z-0 logo-glow-layer neon-icon-blur"></div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-10 transition-all">
                <img src="/icon-192.svg" alt="MockSight" className="w-full h-full object-cover relative z-10" />
              </div>
              {hasUnreadUpdate && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 z-30">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white dark:border-slate-900"></span>
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-[21px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400">
              MockSight
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

                <button
                  className="p-1.5 sm:p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-colors backdrop-blur-md shadow-sm border border-indigo-500 flex"
                  title="Add Mock"
                  onClick={() => {
                    setMockToEdit(undefined);
                    setActiveTab("add-mock");
                    window.scrollTo(0, 0);
                  }}
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

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
                      else if (adminPermissions?.canManageFeatures) firstTab = "features";
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
                      `https://ui-avatars.com/api/?name=${user.displayName || 'u'}`
                    }
                    alt="Profile"
                    className="w-8 h-8 sm:w-10 sm:h-10 object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              </>
            ) : (
              <>
                <div className="hidden md:flex mr-1 items-center">
                  {(theme.startsWith("cyber") || theme === "hero-miles") && (
                     <div className="flex bg-slate-900/40 backdrop-blur-md rounded-full shadow-sm items-center px-2 py-1 gap-1.5 h-9 border border-slate-700/50 mr-2">
                       {[
                         { id: theme.includes("-light") ? "cyber-light" : "cyber", bg: "bg-[#0ea5e9]" },
                         { id: theme.includes("-light") ? "cyber-green-light" : "cyber-green", bg: "bg-[#22c55e]" },
                         { id: theme.includes("-light") ? "cyber-lavender-light" : "cyber-lavender", bg: "bg-[#a855f7]" },
                         { id: theme.includes("-light") ? "cyber-pink-light" : "cyber-pink", bg: "bg-[#ec4899]" },
                         { id: theme.includes("-light") ? "cyber-orange-light" : "cyber-orange", bg: "bg-[#f97316]" },
{ id: "hero-miles", bg: "bg-gradient-to-br from-[#ea3323] via-[#ea3323] to-black" },
                       ].map((color) => (
                         <button
                           key={color.id}
                           onClick={() => setTheme(color.id as any)}
                           className={`w-4 h-4 rounded-full flex items-center justify-center overflow-hidden relative ${color.bg} ${theme === color.id ? "ring-2 ring-white scale-110 shadow-[0_0_8px_currentColor]" : "opacity-70 hover:opacity-100 hover:scale-110 transition-all"}`}
                           title={"Select " + color.id.split('-').join(' ')}
                           style={{ color: color.bg.includes('gradient') ? '#ea3323' : color.bg.replace("bg-[", "").replace("]", "") }}
                         >
                           {color.id === "hero-miles" && (
                             <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] absolute opacity-50 pointer-events-none stroke-white" style={{ fill: 'none', strokeWidth: 1 }}>
                               <path d="M12 0v24M0 12h24M3 3l18 18M3 21L21 3" />
                               <circle cx="12" cy="12" r="4" />
                               <circle cx="12" cy="12" r="8" />
                               <circle cx="12" cy="12" r="12" />
                             </svg>
                           )}
                         </button>
                       ))}
                     </div>
                   )}
                   
                   <button
                     onClick={() => {
                       if ((theme.startsWith("cyber") || theme === "hero-miles")) {
                         setTheme(theme.includes("-light") ? "light" : "dark");
                       } else {
                         setTheme(theme === "light" ? "cyber-light" : "cyber");
                       }
                     }}
                     className={`p-1.5 sm:p-2 mr-1 rounded-full transition-colors flex ${
                       (theme.startsWith("cyber") || theme === "hero-miles")
                         ? "text-indigo-600 bg-indigo-50/80 dark:text-indigo-400 dark:bg-indigo-900/40"
                         : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50"
                     }`}
                     title={(theme.startsWith("cyber") || theme === "hero-miles") ? "Exit Gamer Mode" : "Enter Gamer Mode"}
                   >
                     <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />
                   </button>
                </div>
                <button
                  onClick={() => setTheme(theme === 'dark' || (theme.startsWith('cyber') && !theme.includes('-light')) ? 'light' : 'dark')}
                  className="p-1.5 sm:p-2 mr-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-full transition-colors backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 flex"
                  title="Toggle Theme"
                >
                  {theme === 'dark' || (theme.startsWith('cyber') && !theme.includes('-light')) ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
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
