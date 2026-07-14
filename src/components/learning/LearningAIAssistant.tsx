import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, User, Sparkles, Paperclip, Image as ImageIcon, FileText, Settings, Trash2, Globe, Maximize2, Minimize2, Copy, Check } from 'lucide-react';

import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { askLearningTutor, ChatMessage } from '../../services/learningGeminiService';
import { useUIStore } from '../../store/uiStore';
import { useChatStore, ChatMode } from '../../store/chatStore';
import { extractPdfPages } from '../../utils/pdfUtils';
import { ChatMessage as ChatMessageBubble } from './ai/ChatMessage';
import { ChatInputForm } from './ai/ChatInputForm';

interface LearningAIAssistantProps {
  isEnlarged?: boolean;
  onToggleEnlarge?: () => void;
}

import { getActiveApiKey } from '../../utils/apiKeyManager';

export function LearningAIAssistant({ isEnlarged, onToggleEnlarge }: LearningAIAssistantProps) {
  const { setActiveTab } = useUIStore();
  const { messagesByMode, setMessages, persistLocally, toggleLocalPersistence, clearHistory, showWebSearchButton, toggleWebSearchButton, useCustomWebSearch, toggleCustomWebSearch } = useChatStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('default');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const currentModeMessages = messagesByMode[chatMode] || [];
  
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

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentModeMessages, isEnlarged]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      text: input.trim() || (attachment && pagesText ? `Please analyze the attached file (Pages ${pagesText}).` : 'Please analyze this attachment.'),
      attachments: attachment && finalAttachmentData && attachment.mimeType ? [{
        data: finalAttachmentData,
        mimeType: attachment.mimeType,
        pages: pagesText || undefined
      }] : undefined
    };
    const chatHistory = [...currentModeMessages, userMessage];
    
    setMessages(chatMode, chatHistory);
    setIsLoading(true);

    const customKey = getActiveApiKey();
    if (!customKey) {
      setMessages(chatMode, [...chatHistory, { 
        role: 'model', 
        text: 'Please set your Gemini API key in the settings (top right gear icon) to chat with the AI Tutor.' 
      }]);
      setIsLoading(false);
      return;
    }

    try {
      const model = localStorage.getItem('geminiModel') || 'gemini-3.1-flash-lite';
      
      const reply = await askLearningTutor(chatHistory, useWebSearch, useCustomWebSearch, model, chatMode, (text, citations) => {
        setIsLoading(false);
        setMessages(chatMode, [...chatHistory, { role: 'model', text: text, citations }]);
      });
      
      setMessages(chatMode, [...chatHistory, { role: 'model', text: reply.text, citations: reply.citations }]);
    } catch (error: any) {
      setMessages(chatMode, [...chatHistory, { 
        role: 'model', 
        text: `Error: ${error.message || 'Something went wrong. Please try again later.'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className={`flex flex-col bg-white dark:bg-slate-900 shadow-lg overflow-hidden ${isEnlarged ? 'fixed inset-0 z-[9999] rounded-none border-0' : 'border border-slate-200 dark:border-slate-800 rounded-2xl h-[500px]'}`}>
      <div className="flex-none p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white">AI Tutor</h3>
            <p className="text-[10px] md:text-xs text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Powered by Gemini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="relative mr-2" ref={modeMenuRef}>
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-medium text-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200 rounded-full transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap"
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

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {currentModeMessages.length <= 1 && (
          <div className="pt-2 space-y-4">
            {chatMode === 'reasoning' && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 p-4 rounded-xl text-sm max-w-md mx-auto text-left flex gap-3 items-start shadow-sm">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-semibold mb-1">Recommended Configuration</p>
                  <p className="opacity-95 leading-relaxed">Reasoning complex analytical puzzles require higher reasoning capabilities. We highly recommend switching your AI Model Version to <b>Gemini 3.5 Flash</b> in settings for the best results.</p>
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
        {currentModeMessages.map((msg, idx) => (
          <ChatMessageBubble key={idx} msg={msg} idx={idx} setActiveTab={setActiveTab} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="max-w-[80%] rounded-2xl rounded-tl-sm p-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex gap-2 items-center">
                <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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
