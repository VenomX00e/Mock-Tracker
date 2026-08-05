import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({
  isOpen,
  title,
  message,
  confirmText = 'Delete',
  isDanger = true,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 text-slate-800 dark:text-slate-100 z-10 my-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
