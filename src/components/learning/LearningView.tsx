import React, { useState, useEffect, useRef } from 'react';
import { Settings, Cpu, ChevronDown, Check, Book, Plus, Trash2, EyeOff, Trophy, Lock, AlertCircle } from 'lucide-react';
import { useAppStateCtx, usePublicSettingsCtx, useUserProfileCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { useGeminiResolution } from '../../hooks/useGeminiResolution';
import { LearningAIAssistant } from './LearningAIAssistant';
import { VocabularyFeed } from './VocabularyFeed';
import { SpeedMathHub } from './SpeedMathHub';
import { PracticeLibrary } from './PracticeLibrary';
import { YptHubView } from './YptHubView';
import { useVocabularyStore } from '../../store/vocabularyStore';
import { subscribeToCanvases } from '../../services/vocabularyFirebaseService';
import { ApiKeyEntry, getApiKeys, saveApiKeys } from '../../utils/apiKeyManager';
import { jarvisEventBus, JarvisActionEvent } from '../../features/jarvis/utils/eventBus';

const MODELS = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Default)' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B IT' },
  { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT' },
];

export function LearningView() {
  const { isOwner, isAdmin } = useAppStateCtx();
  const { profile: userProfile } = useUserProfileCtx();
  const { enableAiTutor, enableVocabulary, enableSpeedMath, enablePracticeLibrary } = usePublicSettingsCtx();

  const isYptAdmin = Boolean(
    isOwner ||
    isAdmin ||
    userProfile?.role === 'admin' ||
    userProfile?.permissions?.canManageYpt
  );
  const canSeeYptTab = true;
  const { isFeatureAllowed: isAiTutorAllowed, isModelLocked: isAiTutorModelLocked, activeModel: aiTutorActiveModel } = useGeminiResolution('ai_tutor');
  const activeTab = useUIStore(state => state.learningTab);
  const setActiveTab = useUIStore(state => state.setLearningTab);
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
    const handleSubNavigate = (action: any) => {
      if (action.type === 'SUB_NAVIGATE') {
        const { mainTab, subTab, section } = action.payload;
        if (mainTab === 'learning') {
          if (subTab === 'practice' && section) {
             setActiveTab('practice');
             // We need to pass the section down. 
             // Best way without context is to use a global store or dispatch another event inside PracticeLibrary.
             // For now we will rely on PracticeLibrary picking up the same event.
          }
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleSubNavigate);
    return () => unsubscribe();
  }, []);


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
    const syncKeys = () => setKeys(getApiKeys());
    syncKeys();
    window.addEventListener('gemini_keys_changed', syncKeys);
    return () => window.removeEventListener('gemini_keys_changed', syncKeys);
  }, [isPopoverOpen]);

  // Sync selected model per learning subpage tab
  useEffect(() => {
    const subKey = `geminiModel_${activeTab}`;
    const savedSubModel = localStorage.getItem(subKey);
    const savedGlobalModel = localStorage.getItem('geminiModel');
    setSelectedModel(savedSubModel || savedGlobalModel || MODELS[0].value);
  }, [activeTab]);

  useEffect(() => {
    const handleJarvisAction = (action: JarvisActionEvent) => {
      if (action.type === 'NAVIGATE' && action.payload) {
        const fullPath = action.payload.replace(/^\//, '');
        const parts = fullPath.split('/');
        // e.g. "learning/vocab" or just "vocab" if we are already in learning.
        const subTab = parts.length > 1 ? parts[1] : parts[0];
        
        if (['ai', 'vocab', 'math', 'practice', 'ypt'].includes(subTab)) {
          setActiveTab(subTab as any);
        }
      }
    };

    const unsubscribe = jarvisEventBus.subscribe(handleJarvisAction);
    return () => unsubscribe();
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
    if (newKeyInput.trim()) {
      const newEntry: ApiKeyEntry = {
        id: Date.now().toString(),
        key: newKeyInput.trim(),
        isActive: true,
      };
      const updatedKeys = [...keys, newEntry];
      setKeys(updatedKeys);
      saveApiKeys(updatedKeys);
      setNewKeyInput('');
    }
    const subKey = `geminiModel_${activeTab}`;
    localStorage.setItem(subKey, selectedModel);
    localStorage.setItem('geminiModel', selectedModel);
    window.dispatchEvent(new Event('gemini_keys_changed'));
    setIsPopoverOpen(false);
  };

  const TAB_NAMES: Record<string, string> = {
    ypt: 'YPT',
    ai: 'AI Tutor',
    vocab: 'Vocabulary',
    math: 'Speed Math',
    practice: 'Practice Library',
  };

  const maskKey = (key: string) => {
    if (key.length <= 10) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  return (
    <div data-jarvis-section="Learning Hub" className={`flex flex-col h-full relative ${isEnlarged ? 'space-y-0' : 'space-y-6'}`}>
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
                title={`Configure AI Settings for ${TAB_NAMES[activeTab] || 'Learning'}`}
              >
                <Settings className="w-5 h-5" />
              </button>

              {isPopoverOpen && (
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {TAB_NAMES[activeTab] || 'AI'} Settings
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                      {TAB_NAMES[activeTab] || activeTab}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Configure Gemini model version & API keys for the <span className="font-semibold text-slate-700 dark:text-slate-300">{TAB_NAMES[activeTab] || 'current'}</span> tab.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5 mb-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <Cpu className="w-3.5 h-3.5" />
                        AI Model Version
                      </label>
                      <div className="relative" ref={dropdownRef}>
                        <button
                          type="button"
                          disabled={isAiTutorModelLocked}
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className={`w-full flex items-center justify-between text-left bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-3 py-2.5 outline-none transition-all text-sm font-medium shadow-sm ${
                            isAiTutorModelLocked ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer'
                          }`}
                        >
                          <span className="truncate">
                            {isAiTutorModelLocked ? (MODELS.find(m => m.value === aiTutorActiveModel)?.label || aiTutorActiveModel) : (MODELS.find(m => m.value === selectedModel)?.label || selectedModel)}
                          </span>
                          {isAiTutorModelLocked ? (
                            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          )}
                        </button>

                        {isAiTutorModelLocked && (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-1.5 font-medium">
                            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{MODELS.find(m => m.value === aiTutorActiveModel)?.label || aiTutorActiveModel} (Global Key) • Add personal key to switch model</span>
                          </div>
                        )}

                        {!isAiTutorModelLocked && isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-1 shadow-xl z-[120]">
                            {MODELS.map(m => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => {
                                  setSelectedModel(m.value);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm transition-colors ${
                                  selectedModel === m.value 
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium' 
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span className="truncate">{m.label}</span>
                                {selectedModel === m.value && <Check className="w-4 h-4 shrink-0" />}
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
            {canSeeYptTab && (
              <button
                data-jarvis-item={`Learning Tab: YPT [State: ${activeTab === 'ypt' ? 'Active' : 'Inactive'}]`}
                onClick={() => setActiveTab('ypt')}
                className={`flex items-center gap-1.5 px-3 md:px-5 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'ypt' 
                    ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                YPT
              </button>
            )}
            {(enableAiTutor || isOwner || isAdmin) && (
              <button
                data-jarvis-item={`Learning Tab: AI Tutor [State: ${activeTab === 'ai' ? 'Active' : 'Inactive'}]`}
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
                data-jarvis-item={`Learning Tab: Vocabulary [State: ${activeTab === 'vocab' ? 'Active' : 'Inactive'}]`}
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
                data-jarvis-item={`Learning Tab: Speed Math [State: ${activeTab === 'math' ? 'Active' : 'Inactive'}]`}
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
                data-jarvis-item={`Learning Tab: Practice Library [State: ${activeTab === 'practice' ? 'Active' : 'Inactive'}]`}
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
        {activeTab === 'ypt' && (
          canSeeYptTab ? (
            <YptHubView />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm my-6 max-w-lg mx-auto">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Trophy className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                YPT Profile Required
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                To view and participate in YPT Group Challenges, please add your YPT handle or username in your Profile Settings first.
              </p>
              <button
                onClick={() => {
                  useUIStore.getState().setActiveTab('profile');
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <span>Go to Profile Settings</span>
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

