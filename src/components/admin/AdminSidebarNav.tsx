import React from "react";
import { Shield, Users, Radio, FileText, Timer, Settings, ArrowLeft, Search, GraduationCap } from "lucide-react";

interface AdminSidebarNavProps {
  isOwner: boolean;
  activeTab: string;
  setActiveTab: (val: string) => void;
  adminPermissions: any;
  adminCategoryScope: string | null;
  setAdminCategoryScope: (val: string | null) => void;
  isForcedCategory: boolean;
  currentCategory?: string | null;
  asPage?: boolean;
}

export function AdminSidebarNav({
  isOwner,
  activeTab,
  setActiveTab,
  adminPermissions,
  adminCategoryScope,
  setAdminCategoryScope,
  isForcedCategory,
  currentCategory,
  asPage
}: AdminSidebarNavProps) {
  return (
    <div
              className={`w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 flex flex-col shrink-0 ${asPage ? "" : ""}`}
            >
            <div className="hidden md:flex p-6 border-b border-slate-100 dark:border-slate-800 items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isOwner ? "Owner" : "Admin panel"}
              </h2>
            </div>
            <div className="p-3 flex flex-row overflow-x-auto overflow-y-hidden md:overflow-y-auto custom-scrollbar md:flex-col gap-2 md:gap-0 md:space-y-1 md:flex-1">
              {adminCategoryScope && isOwner && !isForcedCategory && (
                <div className="flex-shrink-0 md:mb-6 md:space-y-1 flex items-center">
                  <button
                    onClick={() => {
                      setActiveTab("categories");
                    }}
                    className="whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to{" "}
                    {adminCategoryScope}
                  </button>
                </div>
              )}
              <div
                className={`flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-1 md:mb-6 ${adminCategoryScope && isOwner ? "opacity-50 pointer-events-none" : ""}`}
              >
                {isOwner && (
                  <h3 className="hidden md:block px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Owner Panel
                  </h3>
                )}

                {isOwner && (
                  <button
                    onClick={() => {
                      setActiveTab("admins");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "admins" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Shield className="w-4 h-4" /> Admins
                  </button>
                )}

                {(isOwner || adminPermissions?.canManageUsers) && (
                  <button
                    onClick={() => {
                      setActiveTab("users");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "users" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Users className="w-4 h-4" /> Users
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageLiveMocks && (
                  <button
                    onClick={() => {
                      setActiveTab("liveMock");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "liveMock" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Radio className="w-4 h-4" /> Live Mock
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageNotices && (
                  <button
                    onClick={() => {
                      setActiveTab("notice");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "notice" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <FileText className="w-4 h-4" /> Notice
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageCountdowns && (
                  <button
                    onClick={() => {
                      setActiveTab("countdown");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "countdown" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Timer className="w-4 h-4" /> Countdowns
                  </button>
                )}
                {!isOwner && adminPermissions?.canManageChallenges && (
                  <button
                    onClick={() => {
                      setActiveTab("challenge");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "challenge" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Timer className="w-4 h-4" /> Challenges
                  </button>
                )}
                {(isOwner || adminPermissions?.canManageSettings) && (
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "settings" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                )}
                {(isOwner || adminPermissions?.canManageQuotes) && (
                  <button
                    onClick={() => {
                      setActiveTab("quotes");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "quotes" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <FileText className="w-4 h-4" /> Quotes
                  </button>
                )}
                {(isOwner || adminPermissions?.canManageLearning) && (
                  <button
                    onClick={() => {
                      setActiveTab("learning");
                      setAdminCategoryScope(
                        isForcedCategory ? currentCategory || null : null,
                      );
                    }}
                    className={`whitespace-nowrap shrink-0 md:shrink w-auto md:w-full flex items-center gap-2 md:gap-3 px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "learning" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-700" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}
                  >
                    <GraduationCap className="w-4 h-4" /> Learning
                  </button>
                )}
              </div>
            </div>
          </div>
  );
}
