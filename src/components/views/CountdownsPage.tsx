import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { CountdownCard } from '../CountdownCard';
import { useSystemDataCtx, useAppStateCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { motion } from 'motion/react';

export function CountdownsPage() {
  const { countdowns, pinnedCountdowns, selectedCategory, togglePin } = useSystemDataCtx();
  const { adminPermissions } = useAppStateCtx();
  const { setAdminEditCountdown, setAdminTab, setIsAdminModalOpen, setActiveTab } = useUIStore();
  
  const [tappedCountdownId, setTappedCountdownId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date().getTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredCountdowns = [...countdowns]
    .filter(c => c.categoryId === selectedCategory || (!c.categoryId && selectedCategory === 'banking'))
    .sort((a, b) => {
      const aIdx = pinnedCountdowns.indexOf(a.id);
      const bIdx = pinnedCountdowns.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  const grouped = useMemo(() => {
    const groups: { [monthStr: string]: any[] } = {};
    
    filteredCountdowns.forEach(c => {
      const d = new Date(c.date);
      if (isNaN(d.getTime())) return;
      
      const monthStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthStr]) {
        groups[monthStr] = [];
      }
      groups[monthStr].push(c);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    sortedKeys.forEach(key => {
      groups[key].sort((ca, cb) => new Date(ca.date).getTime() - new Date(cb.date).getTime());
    });

    return { groups, sortedKeys };
  }, [filteredCountdowns]);

  const canManageCountdowns = adminPermissions?.canManageCountdowns || false;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 bg-white dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400">All Countdowns</h2>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24">
        <div className="w-full space-y-8">
          {grouped.sortedKeys.map(monthStr => (
            <div key={monthStr}>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 py-2 border-b border-slate-200 dark:border-slate-800">
                {monthStr}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {grouped.groups[monthStr].map((c: any) => (
                  <CountdownCard
                    key={c.id}
                    countdown={c}
                    now={now}
                    tappedCountdownId={tappedCountdownId}
                    setTappedCountdownId={setTappedCountdownId}
                    isPinned={pinnedCountdowns.includes(c.id)}
                    canManageCountdowns={canManageCountdowns}
                    togglePin={togglePin}
                    setAdminEditCountdown={setAdminEditCountdown}
                    setAdminTab={setAdminTab}
                    setIsAdminModalOpen={setIsAdminModalOpen}
                    isModal={true}
                  />
                ))}
              </div>
            </div>
          ))}
          {grouped.sortedKeys.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
              No valid countdowns available.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
