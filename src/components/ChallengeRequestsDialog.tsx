import React from 'react';
import { X, Check, XCircle, Edit2, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChallengeRequestsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  challenges: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (challenge: any) => void;
}

export default function ChallengeRequestsDialog({ isOpen, onClose, challenges, onApprove, onReject, onEdit }: ChallengeRequestsDialogProps) {
  if (!isOpen) return null;

  const pendingChallenges = challenges.filter(c => c.visibility === 'global' && c.approvalStatus === 'pending');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/50  z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0 } }}
          className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Timer className="w-5 h-5 text-indigo-500" /> Challenge Requests
            </h2>
            <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {pendingChallenges.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No pending requests.
              </div>
            ) : (
              <ul className="space-y-4">
                {pendingChallenges.map(c => (
                  <li key={c.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">{c.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.description}</p>
                      <div className="flex gap-2 mt-2">
                         <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-medium">{c.durationDays} Days</span>
                         <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 font-medium capitalize">{c.challengeType}</span>
                         <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-bold uppercase tracking-wide">Pending</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={() => onApprove(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-sm font-bold transition-colors">
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => onReject(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg text-sm font-bold transition-colors">
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button onClick={() => onEdit(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg text-sm font-bold transition-colors">
                        <Edit2 className="w-4 h-4" /> Edit
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
