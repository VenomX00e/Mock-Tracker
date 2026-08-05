import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useJarvis } from '../hooks/useJarvis';
import { Bot, X, Send, Loader2, Compass } from 'lucide-react';

export function JarvisWidget() {
  const { isOpen, messages, isThinking, navigationNotice, toggleOpen, streamedResponse, sendMessage } = useJarvis();
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedResponse, isThinking, navigationNotice]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    
    const userMsg = input.trim();
    setInput('');
    await sendMessage(userMsg);
  };

  return createPortal(
    <div className="fixed bottom-24 right-6 w-80 h-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl flex flex-col z-[9999] overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 font-medium flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-blue-500" />
          <span>Jarvis Assistant</span>
        </div>
        <button onClick={toggleOpen} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Auto-Navigation Notice Banner */}
      {navigationNotice && (
        <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border-b border-blue-100 dark:border-blue-900/50 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 animate-fadeIn font-medium">
          <Compass size={14} className="animate-spin text-blue-500 shrink-0" />
          <span className="truncate">{navigationNotice}</span>
        </div>
      )}
      
      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 text-sm">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-center">
            How can I assist you today?
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`p-3 rounded-xl max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white self-end rounded-tr-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 self-start rounded-tl-sm'}`}>
              {msg.content}
            </div>
          ))
        )}
        
        {/* Streaming / Thinking state */}
        {(streamedResponse || isThinking) && (
          <div className="p-3 rounded-xl max-w-[85%] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 self-start rounded-tl-sm flex flex-col gap-1">
            {streamedResponse ? streamedResponse : (
               <div className="flex items-center gap-2 text-zinc-500">
                 <Loader2 size={14} className="animate-spin" />
                 <span>Thinking...</span>
               </div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Jarvis..."
          disabled={isThinking}
          className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white disabled:opacity-50"
        />
        <button onClick={handleSend} disabled={isThinking || !input.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
          <Send size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
}
