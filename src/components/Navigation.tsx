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
    <header className="bg-white/80 dark:bg-slate-900/80  border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-0">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() => setIsApiModalOpen(true)}
            title="Configure API Key"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img
                src="/icon-192.svg"
                alt="MockTracker"
                className="w-full h-full object-cover"
              />
            </div>
            <h1
              className="text-lg sm:text-[21px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 group-hover:from-blue-800 group-hover:to-indigo-800 transition-colors"
              style={{
                marginLeft: "-7px",
                paddingLeft: "0px",
                paddingRight: "5px",
              }}
            >
              MockTracker
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                  <div className="flex items-center gap-1 md:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {isOwner && (
                      <button
                        onClick={() => {
                          setActiveTab("admin");
                          window.scrollTo(0, 0);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${activeTab === "admin" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"}`}
                        title="Control Panel"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTab("dashboard");
                        window.scrollTo(0, 0);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${activeTab === "dashboard" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"}`}
                      title="My Mocks"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("community");
                        window.scrollTo(0, 0);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${activeTab === "community" ? "bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"}`}
                      title="Community"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Desktop Tabs */}
                  <div className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl relative">
                    {isOwner && (
                      <button
                        onClick={() => {
                          setActiveTab("admin");
                          window.scrollTo(0, 0);
                        }}
                        className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-100 z-10 ${
                          activeTab === "admin"
                            ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                        }`}
                      >
                        <span className="relative z-10 block pointer-events-none">
                          Control Panel
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTab("dashboard");
                        window.scrollTo(0, 0);
                      }}
                      className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-100 z-10 ${
                        activeTab === "dashboard"
                          ? "text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                      }`}
                    >
                      <span className="relative z-10 block pointer-events-none">
                        My Mocks
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("community");
                        window.scrollTo(0, 0);
                      }}
                      className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors duration-200 z-10 ${
                        activeTab === "community"
                          ? "text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-700 shadow-sm border border-slate-200/50 dark:border-slate-600"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent"
                      }`}
                    >
                      <span className="relative z-10 block pointer-events-none">
                        Community
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMockToEdit(undefined);
                    setActiveTab("add-mock");
                    window.scrollTo(0, 0);
                  }}
                  className="inline-flex items-center justify-center p-2 md:px-4 text-sm font-medium text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 neon-action-btn"
                >
                  <Plus className="w-4 h-4 md:mr-1.5" />
                  <span className="hidden md:inline">Add Mock</span>
                </button>

                {!isOwner && isAdmin && (
                  <button
                    onClick={() => {
                      let firstTab: any = "users";
                      if (adminPermissions?.canManageUsers) firstTab = "users";
                      else if (adminPermissions?.canManageLiveMocks)
                        firstTab = "liveMock";
                      else if (adminPermissions?.canManageNotices)
                        firstTab = "notice";
                      else if (adminPermissions?.canManageCountdowns)
                        firstTab = "countdown";
                      else if (adminPermissions?.canManageChallenges)
                        firstTab = "challenge";
                      else if (adminPermissions?.canManageSettings)
                        firstTab = "settings";
                      else firstTab = "";

                      setAdminTab(firstTab);
                      setAdminEditNotice(null);
                      setAdminEditCountdown(null);
                      setActiveTab("admin");
                      window.scrollTo(0, 0);
                    }}
                    className="p-1.5 md:p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent rounded-lg transition-colors"
                    title="Control Panel"
                  >
                    <Shield className="w-5 h-5" />
                  </button>
                )}

                {isInstallable && (
                  <button
                    onClick={installApp}
                    className="p-1.5 md:p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent rounded-lg transition-colors hidden sm:flex"
                    title="Install App"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}

                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 md:p-1.5 rounded-lg transition-colors border border-transparent"
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
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                  />
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={signInWithGoogle}
                  className="inline-flex flex-nowrap whitespace-nowrap items-center justify-center px-4 sm:px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm neon-action-btn"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  <span>Sign In</span>
                </button>

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 md:mx-2 hidden sm:block"></div>

                {theme.startsWith("cyber") && (
                  <div className="flex items-center gap-1.5 ml-1 hidden sm:flex bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-full shadow-inner border border-slate-200 dark:border-slate-700">
                    {[
                      {
                        id: theme.includes("-light") ? "cyber-light" : "cyber",
                        bg: "bg-[#0ea5e9]",
                      },
                      { id: theme.includes("-light") ? "cyber-green-light" : "cyber-green", bg: "bg-[#22c55e]" },
                      { id: theme.includes("-light") ? "cyber-lavender-light" : "cyber-lavender", bg: "bg-[#a855f7]" },
                      { id: theme.includes("-light") ? "cyber-pink-light" : "cyber-pink", bg: "bg-[#ec4899]" },
                      { id: theme.includes("-light") ? "cyber-orange-light" : "cyber-orange", bg: "bg-[#f97316]" },
                    ].map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setTheme(color.id as any)}
                        className={`w-4 h-4 rounded-full ${color.bg} ${theme === color.id ? "ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400 dark:ring-offset-slate-900 border-2 border-white" : "opacity-60 hover:opacity-100 hover:scale-110 transition-all"}`}
                        title={"Select " + color.id.split('-').join(' ') + " color"}
                      />
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    if (theme.startsWith("cyber")) {
                      setTheme(theme.includes("-light") ? "light" : "dark");
                    } else {
                      setTheme(theme === "light" ? "cyber-light" : "cyber");
                    }
                  }}
                  className={`p-1.5 md:p-2 rounded-full transition-colors flex ${
                    theme.startsWith("cyber")
                      ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  title={
                    theme.startsWith("cyber")
                      ? "Exit Gamer Mode"
                      : "Enter Gamer Mode"
                  }
                >
                  <Gamepad2 className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    if (theme.startsWith("cyber")) {
                      if (theme.includes("-light")) {
                        setTheme(theme.replace("-light", "") as any);
                      } else {
                        setTheme((theme === "cyber" ? "cyber-light" : theme + "-light") as any);
                      }
                    } else {
                      setTheme(theme === "light" ? "dark" : "light");
                    }
                  }}
                  className="p-1.5 md:p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex"
                  title="Toggle Theme"
                >
                  {theme === "dark" || (theme.startsWith("cyber") && !theme.includes("-light")) ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
