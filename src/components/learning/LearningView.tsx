import React, { useState, useEffect, useRef } from 'react';
import { Settings, Cpu, ChevronDown, Check, Book, Plus, Trash2, EyeOff } from 'lucide-react';
import { useAppStateCtx, usePublicSettingsCtx } from '../../context/AppContext';
import { LearningAIAssistant } from './LearningAIAssistant';
import { VocabularyFeed } from './VocabularyFeed';
import { SpeedMathHub } from './SpeedMathHub';
import { PracticeLibrary } from './PracticeLibrary';
import { useVocabularyStore } from '../../store/vocabularyStore';
import { subscribeToCanvases } from '../../services/vocabularyFirebaseService';
import { ApiKeyEntry, getApiKeys, saveApiKeys } from '../../utils/apiKeyManager';

const MODELS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Default)' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
];

export function LearningView() {
  const { isOwner, isAdmin } = useAppStateCtx();
  const { enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary } = usePublicSettingsCtx();
  const [activeTab, setActiveTab] = useState<'ai' | 'vocab' | 'math' | 'practice'>('ai');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0].value);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const setCanvases = useVocabularyStore(state => state.setCanvases);

  useEffect(() => {
    // Determine the next available tab if the current one is disabled
    const availableTabs = [];
    if (enableAiTutor || isAdmin || isOwner) availableTabs.push('ai');
    if (enableVocabulary || isAdmin || isOwner) availableTabs.push('vocab');
    if (enableSpeedMath || isAdmin || isOwner) availableTabs.push('math');
    if (enablePracticeLibrary || isAdmin || isOwner) availableTabs.push('practice');
    
    // If current tab isn't available, jump to the first one available
    if (activeTab === 'ai' && !enableAiTutor && !isAdmin && !isOwner) {
      setActiveTab((availableTabs[0] as any) || 'ai');
    } else if (activeTab === 'vocab' && !enableVocabulary && !isAdmin && !isOwner) {
      setActiveTab((availableTabs[0] as any) || 'ai');
    } else if (activeTab === 'math' && !enableSpeedMath && !isAdmin && !isOwner) {
      setActiveTab((availableTabs[0] as any) || 'ai');
    } else if (activeTab === 'practice' && !enablePracticeLibrary && !isAdmin && !isOwner) {
      setActiveTab((availableTabs[0] as any) || 'ai');
    }
  }, [enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary, activeTab, isAdmin, isOwner]);

  useEffect(() => {
    setKeys(getApiKeys());
    const savedModel = localStorage.getItem('geminiModel');
    if (savedModel) setSelectedModel(savedModel);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCanvases((newCanvases) => {
      setCanvases(newCanvases);
    });
    return () => unsubscribe();
  }, [setCanvases]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const handleSaveSettings = () => {
    localStorage.setItem('geminiModel', selectedModel);
    setIsPopoverOpen(false);
  };

  const maskKey = (key: string) => {
    if (key.length <= 10) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return (
    <div className={`flex flex-col h-full relative ${isEnlarged ? 'space-y-0' : 'space-y-6'}`}>
      {!isEnlarged && (
        <div className="flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">Learning</h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-gray-400">Expand your knowledge and master new topics</p>
            </div>
            <div className="relative" ref={popoverRef}>
              <button
                onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                className={`p-2.5 rounded-full transition-colors shadow-sm border ${
                  isPopoverOpen ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700'
                }`}
                title="Configure AI Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {isPopoverOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">AI Tutor Settings</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Set your Gemini API key to use the AI assistant.</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5 mb-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <Cpu className="w-3.5 h-3.5" />
                        AI Model Version
                      </label>
                      <div className="relative" ref={dropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full flex items-center justify-between text-left bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-3 py-2.5 outline-none transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-medium shadow-sm"
                        >
                          <span className="truncate">
                            {MODELS.find(m => m.value === selectedModel)?.label}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-1 shadow-lg z-[120] overflow-hidden">
                            {MODELS.map(m => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => {
                                  setSelectedModel(m.value);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                                  selectedModel === m.value 
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium' 
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span className="truncate">{m.label}</span>
                                {selectedModel === m.value && <Check className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        API Keys Manager
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                          type="password"
                          value={newKeyInput}
                          onChange={(e) => setNewKeyInput(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm"
                          placeholder="Paste new key..."
                        />
                        <button
                          type="button"
                          onClick={handleAddKey}
                          disabled={!newKeyInput.trim()}
                          className="px-3 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="max-h-32 overflow-y-auto space-y-1 mb-2 pr-1 custom-scrollbar">
                        {keys.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-2">No keys added.</p>
                        ) : (
                          keys.map(entry => (
                            <div key={entry.id} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                                  type="checkbox"
                                  checked={entry.isActive}
                                  onChange={() => handleToggleKey(entry.id)}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600 focus:ring-indigo-500"
                                  title="Toggle active"
                                />
                                <span className={`font-mono text-xs truncate ${entry.isActive ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                                  {maskKey(entry.key)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteKey(entry.id)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPopoverOpen(false)}
                        className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSettings}
                        className="flex-1 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors shadow-md hover:bg-slate-800 dark:hover:bg-slate-600"
                      >
                        Save Settings
                      </button>
                    </div>
                    
                    <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                      <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Get a free key</h4>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400/80 leading-relaxed">
                        Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-indigo-800 dark:hover:text-indigo-300">Google AI Studio</a>, click "Create API Key", and paste it here.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full">
            {(enableAiTutor || isOwner || isAdmin) && (
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex items-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'ai' 
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm border border-slate-800 dark:border-slate-200' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                } ${!enableAiTutor ? 'opacity-70 border-dashed' : ''}`}
                title={!enableAiTutor ? "Hidden from regular users" : undefined}
              >
                {!enableAiTutor && <EyeOff className="w-3 h-3" />}
                AI Tutor
              </button>
            )}
            {(enableVocabulary || isOwner || isAdmin) && (
              <button
                onClick={() => setActiveTab('vocab')}
                className={`flex items-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'vocab' 
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm border border-slate-800 dark:border-slate-200' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                } ${!enableVocabulary ? 'opacity-70 border-dashed' : ''}`}
                title={!enableVocabulary ? "Hidden from regular users" : undefined}
              >
                {!enableVocabulary && <EyeOff className="w-3 h-3" />}
                Vocabulary
              </button>
            )}
            {(enableSpeedMath || isOwner || isAdmin) && (
              <button
                onClick={() => setActiveTab('math')}
                className={`flex items-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'math' 
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm border border-slate-800 dark:border-slate-200' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                } ${!enableSpeedMath ? 'opacity-70 border-dashed' : ''}`}
                title={!enableSpeedMath ? "Hidden from regular users" : undefined}
              >
                {!enableSpeedMath && <EyeOff className="w-3 h-3" />}
                Speed Math
              </button>
            )}
            {(enablePracticeLibrary || isOwner || isAdmin) && (
              <button
                onClick={() => setActiveTab('practice')}
                className={`flex items-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'practice' 
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm border border-slate-800 dark:border-slate-200' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                } ${!enablePracticeLibrary ? 'opacity-70 border-dashed' : ''}`}
                title={!enablePracticeLibrary ? "Hidden from regular users" : undefined}
              >
                {!enablePracticeLibrary && <EyeOff className="w-3 h-3" />}
                Practice Library
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${isEnlarged ? 'pb-0' : 'pb-20'} no-scrollbar h-full`}>
        {activeTab === 'ai' && <LearningAIAssistant isEnlarged={isEnlarged} onToggleEnlarge={() => setIsEnlarged(!isEnlarged)} />}
        {activeTab === 'vocab' && <VocabularyFeed />}
        {activeTab === 'math' && <SpeedMathHub />}
        {activeTab === 'practice' && <PracticeLibrary />}
      </div>
    </div>
  );
}

