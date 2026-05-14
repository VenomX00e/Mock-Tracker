import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import { CountdownCard } from '../CountdownCard';
import { motion } from 'motion/react';

interface AllCountdownsModalProps {
  countdowns: any[];
  now: number;
  onClose: () => void;
  // passthrough props
  tappedCountdownId: string | null;
  setTappedCountdownId: (id: string | null) => void;
  pinnedCountdowns: string[];
  canManageCountdowns: boolean;
  togglePin: (id: string, e: React.MouseEvent, canManageCountdowns: boolean) => void;
  setAdminEditCountdown: (countdown: any) => void;
  setAdminTab: (tab: any) => void;
  setIsAdminModalOpen: (isOpen: boolean) => void;
}

export function AllCountdownsModal({
  countdowns,
  now,
  onClose,
  tappedCountdownId,
  setTappedCountdownId,
  pinnedCountdowns,
  canManageCountdowns,
  togglePin,
  setAdminEditCountdown,
  setAdminTab,
  setIsAdminModalOpen
}: AllCountdownsModalProps) {

  // Group by month
  const grouped = useMemo(() => {
    const groups: { [monthStr: string]: any[] } = {};
    
    countdowns.forEach(c => {
      const d = new Date(c.date);
      // Fallback for valid dates
      if (isNaN(d.getTime())) return;
      
      const monthStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthStr]) {
        groups[monthStr] = [];
      }
      groups[monthStr].push(c);
    });

    // Sort months chronologically
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    // Sort countdowns within each month
    sortedKeys.forEach(key => {
      groups[key].sort((ca, cb) => new Date(ca.date).getTime() - new Date(cb.date).getTime());
    });

    return { groups, sortedKeys };
  }, [countdowns]);

  return createPortal(
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400">All Countdowns</h2>
        </div>
        <button 
          onClick={onClose}
          className="hidden sm:flex p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 custom-scrollbar">
        <div className="w-full space-y-8">
          {grouped.sortedKeys.map(monthStr => (
            <div key={monthStr}>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 py-2">
                {monthStr}
              </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {grouped.groups[monthStr].map(c => (
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
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No valid countdowns available.
            </div>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
