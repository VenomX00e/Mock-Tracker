import React from 'react';
// @ts-ignore
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, DownloadCloud } from 'lucide-react';

export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      console.log('SW Registered');
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-5">
      <div className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/50 shadow-2xl rounded-2xl p-4 max-w-sm w-full mx-auto flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex justify-center items-center shrink-0">
              {needRefresh ? <RefreshCw className="w-5 h-5 animate-spin-slow" /> : <DownloadCloud className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {needRefresh ? 'Update Available ✨' : 'Ready Offline 📱'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {needRefresh 
                  ? 'A new version is ready. Reload to get the latest features!' 
                  : 'App installed and ready to work offline.'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {needRefresh && (
          <button 
            onClick={() => updateServiceWorker(true)}
            className="w-full py-2.5 mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none"
          >
            Reload to Update
          </button>
        )}
      </div>
    </div>
  );
}
