import React from 'react';
import { Target, X, EyeOff, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HiddenChallengesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  hiddenChallenges: any[];
  onRestore: (id: string) => void;
}

export default function HiddenChallengesDialog({
  isOpen,
  onClose,
  hiddenChallenges,
  onRestore
}: HiddenChallengesDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-indigo-500" /> Hidden Challenges
            </h2>
            <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {hiddenChallenges.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No hidden challenges.
              </div>
            ) : (
              <ul className="space-y-4">
                {hiddenChallenges.map(c => (
                  <li key={c.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">{c.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{c.description}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                         <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-medium">{c.durationDays} Days</span>
                         <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-medium capitalize">{c.challengeType}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={() => onRestore(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-bold transition-colors">
                        <RefreshCcw className="w-4 h-4" /> Unhide
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
