import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, User, Sparkles, Paperclip, Image as ImageIcon, FileText, Settings, Trash2, Globe, Maximize2, Minimize2, Copy, Check, Lock, AlertCircle, ChevronDown } from 'lucide-react';
import { useGeminiResolution } from '../../hooks/useGeminiResolution';
import { AVAILABLE_MOCK_MODELS, formatModelName } from '../mocks/SubjectRow';

import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { askLearningTutor, ChatMessage } from '../../services/learningGeminiService';
import { useUIStore } from '../../store/uiStore';
import { useChatStore, ChatMode, CustomSearchApi } from '../../store/chatStore';
import { extractPdfPages } from '../../utils/pdfUtils';
import { ChatMessage as ChatMessageBubble } from './ai/ChatMessage';
import { ChatInputForm } from './ai/ChatInputForm';
import { AppStateCtx } from '../../context/AppContext';
import { useContext } from 'react';
import { jarvisEventBus, JarvisActionEvent } from '../../features/jarvis/utils/eventBus';

interface LearningAIAssistantProps {
  isEnlarged?: boolean;
  onToggleEnlarge?: () => void;
}

import { getActiveApiKey } from '../../utils/apiKeyManager';

export function LearningAIAssistant({ isEnlarged, onToggleEnlarge }: LearningAIAssistantProps) {
  const { setActiveTab } = useUIStore();
  const { isOwner } = useContext(AppStateCtx) || { isOwner: false };
  const { isFeatureAllowed, isModelLocked, activeModel, userHasPersonalKey } = useGeminiResolution('ai_tutor');
  const { messagesByMode, setMessages, persistLocally, toggleLocalPersistence, clearHistory, showWebSearchButton, toggleWebSearchButton, useCustomWebSearch, toggleCustomWebSearch, customSearchApi, setCustomSearchApi } = useChatStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('default');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showSearchApiMenu, setShowSearchApiMenu] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const currentModeMessages = messagesByMode[chatMode] || [];
  const displayedMessages = streamingMessage ? [...currentModeMessages, streamingMessage] : currentModeMessages;
  
  useEffect(() => {
    if (isEnlarged) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEnlarged]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const searchApiMenuRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
      if (searchApiMenuRef.current && !searchApiMenuRef.current.contains(event.target as Node)) {
        setShowSearchApiMenu(false);
      }
      if (modelPickerRef.current && !modelPickerRef.current.contains(event.target as Node)) {
        setIsModelPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSendRef = useRef<any>(null);

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    const handleJarvisAction = (action: JarvisActionEvent) => {
      const topic = action.payload?.topic || (action as any).topic;
      if (action.type === 'EXECUTE_INTENT' && action.intent === 'OPEN_AI_TUTOR' && topic) {
        if (handleSendRef.current) {
          handleSendRef.current({ input: topic, attachment: null, pdfPagesInput: "", useWebSearch: false });
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleJarvisAction);
    return () => unsubscribe();
  }, []);

  const handleSend = async (params: { input: string; attachment: any; pdfPagesInput: string; useWebSearch: boolean }) => {
    const { input, attachment, pdfPagesInput, useWebSearch } = params;
    
    let finalAttachmentData = attachment?.data;
    let pagesText = pdfPagesInput.trim();
    
    if (attachment && attachment.type === 'pdf' && attachment.file) {
      setIsLoading(true);
      try {
        const arrayBuffer = await attachment.file.arrayBuffer();
        finalAttachmentData = await extractPdfPages(arrayBuffer, pagesText);
      } catch (error) {
        console.error("Error processing PDF:", error);
        setIsLoading(false);
        return;
      }
    }

    const userMessage: ChatMessage = { 
      role: 'user', 
      text: input.trim(),
      attachments: attachment && finalAttachmentData ? [{
        data: finalAttachmentData,
        mimeType: attachment.mimeType || (attachment.type === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        pages: pagesText || undefined
      }] : undefined
    };
    const chatHistory = [...currentModeMessages, userMessage];
    
    setMessages(chatMode, chatHistory);
    setIsLoading(true);

    if (!isFeatureAllowed) {
      setMessages(chatMode, [...chatHistory, { 
        role: 'model', 
        text: 'An API Key is required for AI Tutor. Please add your Gemini key in Settings or request access from your Administrator.' 
      }]);
      setIsLoading(false);
      return;
    }

    let rafId: number | null = null;
    try {
      const modelToUse = activeModel;
      
      // Keep payload lightweight by not re-sending large base64 attachments from older turns
      const sanitizedHistory: ChatMessage[] = chatHistory.map((msg, index) => {
        const isLatest = index === chatHistory.length - 1;
        if (isLatest || !msg.attachments || msg.attachments.length === 0) {
          return msg;
        }
        return {
          ...msg,
          attachments: undefined,
          text: msg.text.includes("[Image") ? msg.text : `${msg.text ? `${msg.text} ` : ''}[Image attached in previous turn]`
        };
      });

      let targetText = '';
      let displayedLen = 0;
      let latestCitations: any = undefined;
      let latestModelUsed: string = modelToUse;
      let streamCompleted = false;

      const stepPacer = () => {
        const totalLen = targetText.length;
        if (displayedLen < totalLen) {
          const remaining = totalLen - displayedLen;
          // Adaptive pace: steady word-by-word flow, accelerating if buffer builds up or stream finished
          const rawStep = streamCompleted
            ? Math.max(18, Math.ceil(remaining * 0.35))
            : Math.max(4, Math.ceil(remaining * 0.14));

          let nextLen = Math.min(totalLen, displayedLen + rawStep);
          // Snap to next whitespace boundary if close so Markdown/KaTeX never jitters on partial tokens
          if (nextLen < totalLen) {
            const nextSpace = targetText.indexOf(' ', nextLen);
            const nextNewline = targetText.indexOf('\n', nextLen);
            const boundary =
              nextSpace !== -1 && nextNewline !== -1
                ? Math.min(nextSpace, nextNewline)
                : nextSpace !== -1
                  ? nextSpace
                  : nextNewline;
            if (boundary !== -1 && boundary - nextLen <= 10) {
              nextLen = boundary + 1;
            }
          }

          displayedLen = nextLen;
          setStreamingMessage({
            role: 'model',
            text: targetText.slice(0, displayedLen),
            citations: latestCitations,
            modelUsed: latestModelUsed,
          });
        }

        if (displayedLen < targetText.length) {
          rafId = requestAnimationFrame(stepPacer);
        } else {
          rafId = null;
        }
      };

      const reply = await askLearningTutor(sanitizedHistory, useWebSearch, useCustomWebSearch, modelToUse, chatMode, customSearchApi, (text, citations, modelUsed) => {
        setIsLoading(false);
        targetText = text;
        latestCitations = citations;
        latestModelUsed = modelUsed || modelToUse;
        if (rafId === null && displayedLen < targetText.length) {
          rafId = requestAnimationFrame(stepPacer);
        }
      });

      streamCompleted = true;
      targetText = reply.text;
      latestCitations = reply.citations;
      latestModelUsed = reply.modelUsed || modelToUse;

      // Wait briefly if the smooth pacer is finishing the tail of the stream
      if (displayedLen < targetText.length) {
        if (rafId === null) {
          rafId = requestAnimationFrame(stepPacer);
        }
        await new Promise<void>((resolve) => {
          const checkDone = () => {
            if (displayedLen >= targetText.length || rafId === null) {
              resolve();
            } else {
              requestAnimationFrame(checkDone);
            }
          };
          requestAnimationFrame(checkDone);
        });
      }

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setStreamingMessage(null);
      setMessages(chatMode, [...chatHistory, { role: 'model', text: reply.text, citations: reply.citations, modelUsed: reply.modelUsed || modelToUse }]);
    } catch (error: any) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setStreamingMessage(null);
      setMessages(chatMode, [...chatHistory, { 
        role: 'model', 
        text: `Error: ${error.message || 'Something went wrong. Please try again later.'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className={`flex flex-col bg-white dark:bg-slate-900 shadow-lg overflow-hidden ${isEnlarged ? 'fixed inset-0 z-[9999] rounded-none border-0' : 'border border-slate-200 dark:border-slate-800 rounded-2xl h-[540px]'}`}>
      <div className="flex-none px-4 py-3.5 bg-slate-50/40 dark:bg-slate-950/30 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl neon-icon-container bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-500/30 flex flex-col items-center justify-center shadow-xs">
            <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white">AI Tutor</h3>
              {activeModel && (
                <div className="relative inline-flex items-center" ref={modelPickerRef}>
                  <span className="text-slate-300 dark:text-slate-700 mr-1.5">•</span>
                  {isModelLocked ? (
                    <span
                      className="text-[11px] font-normal text-slate-400 dark:text-slate-500 tracking-normal flex items-center gap-1"
                      title={`Model locked by Admin ${userHasPersonalKey ? '(Custom Key)' : '(Global Access)'}`}
                    >
                      <span>{formatModelName(activeModel)}</span>
                      <Lock className="w-2.5 h-2.5 text-slate-400/80 dark:text-slate-500/80" />
                    </span>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsModelPickerOpen(prev => !prev)}
                        className="text-[11px] font-normal text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 tracking-normal flex items-center gap-1 transition-colors group cursor-pointer"
                        title="Switch model for AI Tutor"
                      >
                        <span className="underline decoration-dotted decoration-slate-300 dark:decoration-slate-600 underline-offset-2">{formatModelName(activeModel)}</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </button>
                      {isModelPickerOpen && (
                        <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 min-w-[170px]">
                          <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                            AI Tutor Model
                          </div>
                          <div className="max-h-48 overflow-y-auto py-0.5">
                            {AVAILABLE_MOCK_MODELS.map(m => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => {
                                  localStorage.setItem('geminiModel_ai_tutor', m.value);
                                  localStorage.setItem('geminiModel_ai', m.value);
                                  window.dispatchEvent(new Event('gemini_keys_changed'));
                                  setIsModelPickerOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition-colors ${
                                  activeModel === m.value
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span>{m.label}</span>
                                {activeModel === m.value && <Check className="w-3 h-3 text-indigo-500" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Powered by Gemini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isOwner && (
            <div className="relative mr-2" ref={searchApiMenuRef}>
              <button
                onClick={() => setShowSearchApiMenu(!showSearchApiMenu)}
                className="px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-medium text-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200 rounded-full transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap"
              >
                {customSearchApi === 'auto' && '🔍 Auto'}
                {customSearchApi === 'tavily' && '🔍 Tavily'}
                {customSearchApi === 'exa' && '🔍 Exa'}
                {customSearchApi === 'tinyfish' && '🔍 Tinyfish'}
              </button>
              
              {showSearchApiMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 tracking-wider">
                    Search Provider (Owner)
                  </div>
                  <button
                    onClick={() => { setCustomSearchApi('auto'); setShowSearchApiMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${customSearchApi === 'auto' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    🔍 Auto
                  </button>
                  <button
                    onClick={() => { setCustomSearchApi('tavily'); setShowSearchApiMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${customSearchApi === 'tavily' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    🔍 Tavily
                  </button>
                  <button
                    onClick={() => { setCustomSearchApi('exa'); setShowSearchApiMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${customSearchApi === 'exa' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    🔍 Exa
                  </button>
                  <button
                    onClick={() => { setCustomSearchApi('tinyfish'); setShowSearchApiMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${customSearchApi === 'tinyfish' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    🔍 Tinyfish
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Linear small mode tiles on medium & large screens */}
          <div className="hidden md:flex items-center gap-1 mr-1.5">
            {([
              { id: 'default', label: '🧬 Default' },
              { id: 'math', label: '🔢 Quant' },
              { id: 'english', label: '📖 English' },
              { id: 'reasoning', label: '🧠 Reasoning' },
            ] as const).map((mode) => {
              const isActive = chatMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setChatMode(mode.id)}
                  className={`px-2 py-1 text-[11px] rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/40 font-semibold shadow-xs'
                      : 'bg-slate-50/60 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700/60 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          {/* Compact dropdown on small mobile screens */}
          <div className="relative mr-1.5 md:hidden" ref={modeMenuRef}>
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="px-2 py-1 text-[10px] font-medium text-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200 rounded-full transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap"
            >
              {chatMode === 'default' && '🧬 Default'}
              {chatMode === 'math' && '🔢 Quant'}
              {chatMode === 'english' && '📖 English'}
              {chatMode === 'reasoning' && '🧠 Reasoning'}
            </button>
            
            {showModeMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                <button
                  onClick={() => { setChatMode('default'); setShowModeMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${chatMode === 'default' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  🧬 Default
                </button>
                <button
                  onClick={() => { setChatMode('math'); setShowModeMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${chatMode === 'math' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  🔢 Quant
                </button>
                <button
                  onClick={() => { setChatMode('english'); setShowModeMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${chatMode === 'english' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  📖 English
                </button>
                <button
                  onClick={() => { setChatMode('reasoning'); setShowModeMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${chatMode === 'reasoning' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  🧠 Reasoning
                </button>
              </div>
            )}
          </div>
          {onToggleEnlarge && (
            <button
              onClick={onToggleEnlarge}
              className="p-1.5 md:p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-[#2A2B32] rounded-lg transition-colors"
              title={isEnlarged ? "Minimize" : "Full Screen"}
            >
              {isEnlarged ? <Minimize2 className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize2 className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
          )}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-1.5 md:p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-[#2A2B32] rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#1E1F25] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white pb-1">Remember Chats</span>
                    <button 
                      onClick={toggleLocalPersistence}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${persistLocally ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${persistLocally ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 placeholder-opacity-50">Save chat history locally. If off, chats clear on refresh.</p>
                </div>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white pb-1">Gemini Native Search</span>
                    <button 
                      onClick={toggleWebSearchButton}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showWebSearchButton ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showWebSearchButton ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 placeholder-opacity-50">Show search button. Requires paid Gemini API tier.</p>
                </div>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white pb-1">Custom Web Search (Free Tier)</span>
                    <button 
                      onClick={toggleCustomWebSearch}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useCustomWebSearch ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useCustomWebSearch ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 placeholder-opacity-50">Use our backend search APIs. Recommended for free tier.</p>
                </div>
                <button
                  onClick={() => {
                    clearHistory(chatMode);
                    setShowSettingsMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Chat History
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-4 no-scrollbar">
        {isLoading && (
          <div className="flex justify-start">
             <div className="max-w-[80%] rounded-2xl rounded-tl-sm p-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex gap-2 items-center">
                <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
             </div>
          </div>
        )}
        {[...displayedMessages].reverse().map((msg, reverseIdx) => {
          const originalIdx = displayedMessages.length - 1 - reverseIdx;
          return (
            <ChatMessageBubble 
              key={originalIdx} 
              msg={msg} 
              idx={originalIdx} 
              setActiveTab={setActiveTab}
              onSendAnswer={(ans) => handleSend({ input: ans, attachment: null, pdfPagesInput: '', useWebSearch: false })}
              isLoading={isLoading}
            />
          );
        })}
        {currentModeMessages.length <= 1 && !streamingMessage && (
          <div className="pt-2 space-y-4">
            {chatMode === 'reasoning' && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 p-4 rounded-xl text-sm max-w-md mx-auto text-left flex gap-3 items-start shadow-sm">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-semibold mb-1">Recommended Configuration</p>
                  <p className="opacity-95 leading-relaxed">Reasoning complex analytical puzzles require higher reasoning capabilities. We highly recommend switching your AI Model Version to <b>3.8 Flash</b> in the header for the best results.</p>
                </div>
              </div>
            )}
            {chatMode === 'math' && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 p-3.5 rounded-xl text-sm max-w-md mx-auto text-left flex gap-3 items-center shadow-sm">
                <span className="text-xl">🔢</span>
                <p><b>Quick step-by-step competitive shortcuts enabled.</b> Send a question and see calculations broken down instantly.</p>
              </div>
            )}
            {chatMode === 'english' && (
              <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-sky-800 dark:text-sky-200 p-3.5 rounded-xl text-sm max-w-md mx-auto text-left flex gap-3 items-center shadow-sm">
                <span className="text-xl">📖</span>
                <p><b>Quick grammar logic and contextual usage guides enabled.</b> Master sentence correction and vocabulary with concise rules.</p>
              </div>
            )}
          </div>
        )}
        {!isFeatureAllowed && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs max-w-lg mx-auto my-4">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-amber-900 dark:text-amber-100">API Key Required</p>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                An API Key is required for AI Tutor. Please add your Gemini key in Settings or request access from your Administrator.
              </p>
            </div>
          </div>
        )}
      </div>

      <ChatInputForm 
        onSend={handleSend}
        isLoading={isLoading}
        showWebSearchButton={showWebSearchButton || useCustomWebSearch}
        showPrompts={chatMode === 'default' && currentModeMessages.length <= 1}
      />
    </div>
  );

  if (isEnlarged) {
    return createPortal(content, document.body);
  }

  return content;
}
