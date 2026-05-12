import React from 'react';
import { DatabaseZap, BrainCircuit, LineChart, Timer, MessageSquare, LogIn } from 'lucide-react';
import { useAuth } from '../../services/AuthContext';
import { usePublicSettingsCtx } from '../../context/AppContext';

export function AuthView() {
  const { signInWithGoogle } = useAuth();
  const { telegramLink, telegramText } = usePublicSettingsCtx();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] text-center max-w-6xl mx-auto px-4 lg:overflow-hidden lg:-mt-4">
       <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 shadow-inner">
        <DatabaseZap className="w-8 h-8" />
      </div>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
        Track Your Mock Exams Intelligently
      </h2>
      <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 mb-8 max-w-2xl leading-relaxed">
        Upload your mock test scorecard images. Our AI will automatically extract your scores and percentiles. 
        Safely store your historical data across all sessions and track your sectional weak points.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-left w-full">
        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">AI Scorecard Extraction</h3>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Just upload a screenshot of your result. Our AI instantly parses and logs all scores.</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-400">
            <LineChart className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">Deep Trend Analytics</h3>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Track your performance over time with beautiful charts and hit rates.</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center mb-3 text-rose-600 dark:text-rose-400">
            <Timer className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">Challenges & Countdowns</h3>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Join daily task challenges to build streaks and track upcoming live exams visually.</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-3 text-amber-600 dark:text-amber-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">Community Chat</h3>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Engage with aspirants, view leaderboards, share insights, and prep together.</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={signInWithGoogle}
          className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200"
        >
          <LogIn className="w-5 h-5 mr-2" />
          Sign In to Start Tracking
        </button>

          <a
            href={telegramLink || '#'}
            target={telegramLink ? "_blank" : undefined}
            rel={telegramLink ? "noopener noreferrer" : undefined}
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-lg transition-colors mt-2"
            onClick={(e) => {
              if (!telegramLink) {
                e.preventDefault();
                alert('Telegram link is not configured yet. Set it in the Admin Settings.');
              }
            }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {telegramText}
          </a>
      </div>
    </div>
  );
}
