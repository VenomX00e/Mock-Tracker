import React from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { MockScore } from '../../types';

export interface CommunityHubTrashModalProps {
  showTrash: boolean;
  setShowTrash: (val: boolean) => void;
  deletedMocks: MockScore[];
  userMap: Record<string, any>;
  handleAdminRestore: (m: MockScore) => void;
  handleAdminPermanentDelete: (m: MockScore) => void;
}

export const CommunityHubTrashModal: React.FC<CommunityHubTrashModalProps> = ({
  showTrash,
  setShowTrash,
  deletedMocks,
  userMap,
  handleAdminRestore,
  handleAdminPermanentDelete,
}) => {
  if (!showTrash) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40  animate-in fade-in duration-0">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Moderation Trash</h3>
          </div>
          <button 
            onClick={() => setShowTrash(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
           {deletedMocks.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No deleted mocks.</p>
           ) : (
              <div className="space-y-3">
                 {deletedMocks.map((m: MockScore) => {
                    const user = userMap[m.userId!] || {};
                    return (
                      <div key={m.id} className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 border border-red-100 dark:border-red-900/30 rounded-xl bg-red-50/50 dark:bg-red-900/10">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{user.displayName || 'Unknown'}</span>
                              <span className="text-xs text-slate-500">{new Date(m.date).toLocaleDateString()}</span>
                           </div>
                           <div className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                              {m.examType} - {m.mockName} 
                              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm flex gap-2">
                                  <span>Score: {m.score}</span>
                                  <span>{m.percentile}%ile</span>
                              </span>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleAdminRestore(m)}
                             className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                           >
                             Restore
                           </button>
                           <button 
                             onClick={() => handleAdminPermanentDelete(m)}
                             className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-1.5"
                           >
                             Delete Forever
                           </button>
                        </div>
                      </div>
                    );
                 })}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
