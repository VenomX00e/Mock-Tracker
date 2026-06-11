import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Settings, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Home,
  FileText,
  UserCircle,
  CheckSquare,
  GraduationCap
} from 'lucide-react';
import { useAuthCtx, useAppStateCtx, useUserProfileCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';
import { useVersionStore } from '../store/versionStore';

export function Sidebar() {
  const { user } = useAuthCtx();
  const { profile } = useUserProfileCtx();
  const { isOwner, isAdmin, adminPermissions } = useAppStateCtx();
  const { setMockToEdit, setAdminEditNotice, setAdminEditCountdown } = useUIStore();

  const { 
    activeTab, 
    setActiveTab, 
    isSidebarCollapsed, 
    setIsSidebarCollapsed,
    setAdminTab
  } = useUIStore();

  const { hasUnreadUpdate, setUpdateModalOpen } = useVersionStore();

  const [localActiveTab, setLocalActiveTab] = React.useState<string>(activeTab);

  React.useEffect(() => {
    setLocalActiveTab(activeTab);
  }, [activeTab]);

  if (!user) return null;

  const navigateToTab = (tabId: string, customAction?: () => void) => {
    setLocalActiveTab(tabId);
    
    // Use requestAnimationFrame and a small timeout to guarantee the browser paints 
    // the localActiveTab (sidebar button visual change) before loading the heavy page component.
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (customAction) {
          customAction();
        } else {
          setActiveTab(tabId as any);
        }
        window.scrollTo(0, 0);
      }, 50);
    });
  };

  const handleAdminClick = () => {
    navigateToTab("admin", () => {
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
    });
  };

  const menuItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      onClick: () => navigateToTab("home")
    },
    {
      id: "dashboard",
      label: "My Mocks",
      icon: FileText,
      onClick: () => navigateToTab("dashboard")
    },
    {
      id: "learning",
      label: "Learning",
      icon: GraduationCap,
      onClick: () => navigateToTab("learning")
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: CheckSquare,
      onClick: () => navigateToTab("tasks")
    },
    {
      id: "add-mock",
      label: "Add Mock",
      icon: Plus,
      onClick: () => navigateToTab("add-mock", () => {
        setMockToEdit(undefined);
        setActiveTab("add-mock");
      }),
      isAction: true
    }
  ];

  return (
    <div 
      className={`hidden md:flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 relative flex-shrink-0 transition-[width] duration-150 ease-out whitespace-nowrap ${
        isSidebarCollapsed ? "w-[80px]" : "w-[240px]"
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center h-16 shrink-0 pl-6 pr-4">
        <button 
          onClick={() => setUpdateModalOpen(true)}
          className="group flex items-center w-full text-left relative focus:outline-none"
          title="App Version Info & Update"
        >
          <div className="relative shrink-0">
            <div className="absolute inset-0 m-auto w-6 h-6 rounded-full blur-[10px] opacity-70 scale-[1.3] z-0 logo-glow-layer neon-icon-blur"></div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-10 transition-all group-hover:scale-105 group-hover:border-indigo-300 dark:group-hover:border-indigo-500">
              <img src="/icon-192.svg" alt="MockSight" className="w-full h-full object-cover relative z-10" />
            </div>
            {hasUnreadUpdate && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 z-30">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white dark:border-slate-900"></span>
              </span>
            )}
          </div>
          
          <h1 
            className={`text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 shrink-0 transition-all ml-3 group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-pink-600 dark:group-hover:from-indigo-400 dark:group-hover:to-pink-400 ${
              isSidebarCollapsed ? "opacity-0" : "opacity-100"
            }`}
          >
            MockSight
          </h1>
        </button>
      </div>

      {/* Collapse Toggle inside Sidebar, just like trackly mockup if possible. Wait, in trackly, toggle is sometimes on the wrapper or inside. Let's place it here. */}
      <button 
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="absolute -right-3.5 top-[21px] flex items-center justify-center w-7 h-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 z-50 transition-colors"
      >
        {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2 custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = localActiveTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              title={isSidebarCollapsed ? item.label : undefined}
              className={`relative flex items-center transition-colors rounded-xl overflow-hidden w-full h-12 px-4
                ${isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }
              `}
            >
              <div className="w-6 flex shrink-0 items-center justify-center">
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'neon-active-icon' : ''}`} strokeWidth={isActive ? 3 : 2} />
              </div>
              
              <span className={`flex-1 text-left transition-opacity duration-150 ml-3 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {item.label}
              </span>
              
              {isActive && !isSidebarCollapsed && (
                <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.5)] dark:shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 mt-auto shrink-0 flex flex-col gap-2">
        {(isOwner || isAdmin) && (
          <button
            onClick={handleAdminClick}
            title={isSidebarCollapsed ? (isOwner ? "Owner Panel" : "Admin Panel") : undefined}
            className={`relative flex items-center transition-colors rounded-xl overflow-hidden w-full h-12 px-4
              ${localActiveTab === "admin"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              }
            `}
          >
            <div className="w-6 flex shrink-0 items-center justify-center">
              <Shield className={`w-5 h-5 shrink-0 ${localActiveTab === "admin" ? 'neon-active-icon' : ''}`} strokeWidth={localActiveTab === "admin" ? 3 : 2} />
            </div>
            <span className={`flex-1 text-left transition-opacity duration-150 ml-3 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              {isOwner ? "Owner Panel" : "Admin Panel"}
            </span>

            {localActiveTab === "admin" && !isSidebarCollapsed && (
              <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.5)] dark:shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>
            )}
          </button>
        )}

        <button
          onClick={() => navigateToTab("community")}
          title={isSidebarCollapsed ? "Community" : undefined}
          className={`relative flex items-center transition-colors rounded-xl overflow-hidden w-full h-12 px-4
            ${localActiveTab === "community"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }
          `}
        >
          <div className="w-6 flex shrink-0 items-center justify-center">
            <Users className={`w-5 h-5 shrink-0 ${localActiveTab === "community" ? 'neon-active-icon' : ''}`} strokeWidth={localActiveTab === "community" ? 3 : 2} />
          </div>
          <span className={`flex-1 text-left transition-opacity duration-150 ml-3 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            Community
          </span>
          
          {localActiveTab === "community" && !isSidebarCollapsed && (
            <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.5)] dark:shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>
          )}
        </button>

        <button
          onClick={() => navigateToTab("profile")}
          title={isSidebarCollapsed ? "Profile" : undefined}
          className={`relative flex items-center transition-colors rounded-xl overflow-hidden w-full h-12 px-4
            ${localActiveTab === "profile"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }
          `}
        >
          <div className="w-8 h-8 flex shrink-0 items-center justify-center -ml-1">
            {profile?.photoURL || user.photoURL ? (
              <img src={profile?.photoURL || user.photoURL || undefined} alt={profile?.displayName || user.displayName || 'Profile'} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-700" />
            ) : (
              <UserCircle className={`w-7 h-7 shrink-0 ${localActiveTab === "profile" ? 'neon-active-icon' : ''}`} strokeWidth={localActiveTab === "profile" ? 3 : 2} />
            )}
          </div>
          <span className={`flex-1 text-left transition-opacity duration-150 ml-2 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            {profile?.displayName || user.displayName || 'Profile'}
          </span>

          {localActiveTab === "profile" && !isSidebarCollapsed && (
            <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_8px_rgba(79,70,229,0.5)] dark:shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>
          )}
        </button>
      </div>
    </div>
  );
}
