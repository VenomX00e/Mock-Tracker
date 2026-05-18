import React from 'react';

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  onSave: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, apiKeyInput, setApiKeyInput, onSave }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Configure Gemini API Key</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">To use the AI image extraction feature, paste your free Gemini API key below.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="AIzaSy..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200 dark:shadow-none transition-all neon-action-btn"
            >
              Save Key
            </button>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-400 mb-1">How to get a key?</h4>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
            1. Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold hover:text-blue-600 dark:hover:text-blue-400">Google AI Studio</a>.<br/>
            2. Click "Create API Key".<br/>
            3. Copy and paste it here. It's 100% free.
          </p>
        </div>
      </div>
    </div>
  );
};
