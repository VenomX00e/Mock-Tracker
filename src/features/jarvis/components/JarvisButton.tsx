import React from 'react';
import { createPortal } from 'react-dom';
import { useJarvis } from '../hooks/useJarvis';
import { Bot, Sparkles } from 'lucide-react';

export function JarvisButton() {
  const { isOpen, toggleOpen, isThinking, isListening } = useJarvis();

  if (isOpen) return null;

  const isActive = isThinking || isListening;

  return createPortal(
    <button
      onClick={toggleOpen}
      className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl transition-all z-[9999] flex items-center justify-center group ${
        isActive 
          ? 'bg-blue-600 animate-pulse text-white shadow-blue-500/50' 
          : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-105'
      }`}
      title="Open Jarvis"
    >
      {isActive ? (
        <Sparkles size={24} className="animate-spin-slow" />
      ) : (
        <Bot size={24} className="group-hover:animate-pulse" />
      )}
    </button>,
    document.body
  );
}
