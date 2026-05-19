import { useState, useRef, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useInlineEditNotice(user: any, isAdmin: boolean, notices: any[], setNotices: (notices: any[]) => void) {
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineNoticeTitle, setInlineNoticeTitle] = useState('');
  const [inlineNoticeDesc, setInlineNoticeDesc] = useState('');
  const [descHistory, setDescHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);

  const saveInlineNotice = async (id: string) => {
    try {
      const updateData: any = {
        title: inlineNoticeTitle,
        description: inlineNoticeDesc,
        updatedAt: new Date().toISOString()
      };
      
      if (!isAdmin && user) {
        updateData.lastEditedBy = user.uid;
        updateData.lastEditedByEmail = user.email;
      }
      
      await updateDoc(doc(db, 'system', id), updateData);
      setNotices(notices.map(n => n.id === id ? { ...n, title: inlineNoticeTitle, description: inlineNoticeDesc, ...updateData } : n));
      setInlineEditingId(null);
      setDescHistory([]);
      setHistoryIndex(-1);
    } catch (e) {
      console.error(e);
      alert('Failed to save notice inline.');
    }
  };

  const applyInlineFormat = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    let textBefore = text.substring(0, start);
    let selectedText = text.substring(start, end);
    let textAfter = text.substring(end);
    
    let actualStart = start;
    
    const matchBefore = textBefore.match(/<([a-zA-Z0-9]+)>$/);
    const matchAfter = textAfter.match(/^<\/([a-zA-Z0-9]+)>/);
    
    if (matchBefore && matchAfter && matchBefore[1] === matchAfter[1]) {
      const openTag = matchBefore[0];
      const closeTag = matchAfter[0];
      
      textBefore = textBefore.substring(0, textBefore.length - openTag.length);
      textAfter = textAfter.substring(closeTag.length);
      selectedText = openTag + selectedText + closeTag;
      
      actualStart = actualStart - openTag.length;
    }

    const newText = textBefore + before + selectedText + after + textAfter;
    
    setInlineNoticeDesc(newText);
    
    const newHistory = descHistory.slice(0, historyIndex + 1);
    newHistory.push(newText);
    setDescHistory(newHistory.slice(-50));
    setHistoryIndex(Math.min(newHistory.length - 1, 49));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(actualStart + before.length, actualStart + before.length + selectedText.length);
    }, 0);
  };
  
  const handleDescChange = (val: string) => {
      setInlineNoticeDesc(val);
      const lastVal = descHistory[historyIndex];
      if (!lastVal || Math.abs(val.length - lastVal.length) > 1 || val.endsWith(' ') || val.endsWith('\n')) {
          const newHistory = descHistory.slice(0, historyIndex + 1);
          newHistory.push(val);
          setDescHistory(newHistory.slice(-50));
          setHistoryIndex(Math.min(newHistory.length - 1, 49));
      }
  };
  
  const undo = () => {
      if (inlineNoticeDesc !== descHistory[historyIndex] && historyIndex >= 0) {
          setInlineNoticeDesc(descHistory[historyIndex]);
      } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInlineNoticeDesc(descHistory[historyIndex - 1]);
      }
  };

  const redo = () => {
      if (historyIndex < descHistory.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setInlineNoticeDesc(descHistory[historyIndex + 1]);
      }
  };

  return useMemo(() => ({
    inlineEditingId,
    setInlineEditingId,
    inlineNoticeTitle,
    setInlineNoticeTitle,
    inlineNoticeDesc,
    setInlineNoticeDesc,
    descHistory,
    setDescHistory,
    historyIndex,
    setHistoryIndex,
    textareaRef,
    activeNoticeId,
    setActiveNoticeId,
    saveInlineNotice,
    applyInlineFormat,
    handleDescChange,
    undo,
    redo,
  }), [inlineEditingId, inlineNoticeTitle, inlineNoticeDesc, descHistory, historyIndex, activeNoticeId, notices, user, isAdmin]);
}
