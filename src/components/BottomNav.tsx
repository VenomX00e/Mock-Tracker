import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Plus,
  FileText,
  CheckSquare,
  GraduationCap
} from 'lucide-react';
import { useAuthCtx, useAppStateCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';

export function BottomNav() {
  const { user } = useAuthCtx();
  ;
  const { activeTab, 
    setActiveTab, setMockToEdit } = useUIStore();

  if (!user) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50 flex items-center justify-around px-2 pb-safe">
      <button
        onClick={() => {
          setActiveTab("home");
          window.scrollTo(0, 0);
        }}
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          activeTab === "home" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Home</span>
      </button>

      <button
        onClick={() => {
          setActiveTab("dashboard");
          window.scrollTo(0, 0);
        }}
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          activeTab === "dashboard" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
        }`}
      >
        <FileText className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Mocks</span>
      </button>

      <button
        onClick={() => {
          setActiveTab("learning");
          window.scrollTo(0, 0);
        }}
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          activeTab === "learning" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
        }`}
      >
        <GraduationCap className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Learn</span>
      </button>

      <button
        onClick={() => {
          setActiveTab("tasks");
          window.scrollTo(0, 0);
        }}
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          activeTab === "tasks" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
        }`}
      >
        <CheckSquare className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Tasks</span>
      </button>

      <button
        onClick={() => {
          setActiveTab("community");
          window.scrollTo(0, 0);
        }}
        className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
          activeTab === "community" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
        }`}
      >
        <Users className="w-5 h-5 mb-1" />
        <span className="text-[10px] font-medium">Community</span>
      </button>
    </div>
  );
}
