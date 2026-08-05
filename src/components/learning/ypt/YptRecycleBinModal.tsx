import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, RefreshCw, X, ShieldAlert, Trophy } from 'lucide-react';
import { YptChallenge } from '../../../types/yptTypes';
import { restoreYptChallenge, deleteYptChallenge } from '../../../services/yptService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface YptRecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedChallenges: YptChallenge[];
  onRefresh: () => void;
}

export function YptRecycleBinModal({
  isOpen,
  onClose,
  deletedChallenges,
  onRefresh,
}: YptRecycleBinModalProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [challengeToPermanentDelete, setChallengeToPermanentDelete] = useState<YptChallenge | null>(null);

  if (!isOpen) return null;

  const handleRestore = async (challenge: YptChallenge) => {
    setProcessingId(challenge.id);
    try {
      await restoreYptChallenge(challenge.id);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to restore challenge:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!challengeToPermanentDelete) return;
    const targetId = challengeToPermanentDelete.id;
    setProcessingId(targetId);
    try {
      await deleteYptChallenge(targetId);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to permanently delete challenge:', err);
    } finally {
      setProcessingId(null);
      setChallengeToPermanentDelete(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-800 dark:text-slate-100 max-h-[85vh] flex flex-col z-10 my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight flex items-center gap-2">
                Recycle Bin
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restore soft-deleted YPT challenges or remove them permanently.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {deletedChallenges.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Recycle Bin is Empty
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Deleted YPT challenges will appear here before being permanently removed.
              </p>
            </div>
          ) : (
            deletedChallenges.map((c) => (
              <div
                key={c.id}
                className="p-4 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {c.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider">
                      DELETED
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {c.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                    <span>{c.teams?.length || 0} Teams</span>
                    <span>•</span>
                    <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleRestore(c)}
                    disabled={processingId === c.id}
                    className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 border border-emerald-300/50 dark:border-emerald-500/30 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>

                  <button
                    onClick={() => setChallengeToPermanentDelete(c)}
                    disabled={processingId === c.id}
                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 border border-rose-300/50 dark:border-rose-500/30 rounded-xl transition-all disabled:opacity-50"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(challengeToPermanentDelete)}
        title="Permanently Delete Challenge?"
        message={`Are you sure you want to PERMANENTLY delete "${challengeToPermanentDelete?.title}"? This cannot be undone.`}
        confirmText="Delete Permanently"
        isDanger={true}
        isLoading={processingId === challengeToPermanentDelete?.id}
        onConfirm={confirmPermanentDelete}
        onClose={() => setChallengeToPermanentDelete(null)}
      />
    </div>,
    document.body
  );
}
