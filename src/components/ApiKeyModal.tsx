import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ApiKeyEntry, getApiKeys, saveApiKeys } from '../utils/apiKeyManager';
import { Trash2, Plus } from 'lucide-react';

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [newKeyInput, setNewKeyInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setKeys(getApiKeys());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddKey = () => {
    if (!newKeyInput.trim()) return;
    const newEntry: ApiKeyEntry = {
      id: Date.now().toString(),
      key: newKeyInput.trim(),
      isActive: true,
    };
    const updatedKeys = [...keys, newEntry];
    setKeys(updatedKeys);
    saveApiKeys(updatedKeys);
    setNewKeyInput('');
  };

  const handleToggleKey = (id: string) => {
    const updatedKeys = keys.map(k => k.id === id ? { ...k, isActive: !k.isActive } : k);
    setKeys(updatedKeys);
    saveApiKeys(updatedKeys);
  };

  const handleDeleteKey = (id: string) => {
    const updatedKeys = keys.filter(k => k.id !== id);
    setKeys(updatedKeys);
    saveApiKeys(updatedKeys);
  };

  const maskKey = (key: string) => {
    if (key.length <= 10) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Configure Gemini API Keys</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Add one or multiple keys. The app will randomly pick an active key per request.</p>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="password"
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Paste new API key here..."
            />
            <button
              type="button"
              onClick={handleAddKey}
              disabled={!newKeyInput.trim()}
              className="px-4 py-2 bg-blue-600 font-semibold text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 py-2">
            {keys.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic text-center py-4">No API keys added yet.</p>
            ) : (
              keys.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="checkbox"
                      checked={entry.isActive}
                      onChange={() => handleToggleKey(entry.id)}
                      className="w-4 h-4 text-blue-600 rounded bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600 focus:ring-blue-500 focus:ring-2"
                      title="Toggle active state"
                    />
                    <span className={`font-mono text-sm truncate ${entry.isActive ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                      {maskKey(entry.key)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(entry.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Close
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

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};

