import React, { useRef, useState, useEffect } from 'react';
import { useSystemDataCtx, useAppStateCtx, useInlineEditNoticeCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { NoticeCard } from '../NoticeCard';

export function NoticesSection() {
  const { notices, pinnedNotices, selectedCategory, togglePinNotice } = useSystemDataCtx();
  const { activeTab } = useUIStore();
  const { isAdmin, adminPermissions } = useAppStateCtx();
  const {
      inlineEditingId,
      setInlineEditingId,
      saveInlineNotice,
      inlineNoticeTitle,
      setInlineNoticeTitle,
      inlineNoticeDesc,
      setInlineNoticeDesc,
      handleDescChange,
      applyInlineFormat,
      undo,
      redo,
      historyIndex,
      descHistory,
      setDescHistory,
      setHistoryIndex,
      textareaRef
  } = useInlineEditNoticeCtx();

  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Find if we clicked inside a notice card
      const target = e.target as HTMLElement;
      if (!target.closest('.notice-card-container')) {
        setActiveNoticeId(null);
      }
    };
    
    if (activeNoticeId) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeNoticeId]);

  if (activeTab === 'admin') {
    return null;
  }

  const filteredNotices = [...notices]
    .filter(n => n.categoryId === selectedCategory || (!n.categoryId && selectedCategory === 'banking'))
    .sort((a, b) => {
      const aIdx = pinnedNotices.indexOf(a.id);
      const bIdx = pinnedNotices.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    })
    .filter(n => activeTab === 'dashboard' || pinnedNotices.includes(n.id));

  if (filteredNotices.length === 0) return null;

  return (
    <>
      {filteredNotices.map((n) => (
        <NoticeCard
          key={n.id}
          notice={n}
          isAdmin={isAdmin}
          canManageNotices={adminPermissions?.canManageNotices || false}
          isPinned={pinnedNotices.includes(n.id)}
          togglePinNotice={togglePinNotice}
          activeNoticeId={activeNoticeId}
          setActiveNoticeId={setActiveNoticeId}
          inlineEditingId={inlineEditingId}
          setInlineEditingId={setInlineEditingId}
          saveInlineNotice={saveInlineNotice}
          inlineNoticeTitle={inlineNoticeTitle}
          setInlineNoticeTitle={setInlineNoticeTitle}
          inlineNoticeDesc={inlineNoticeDesc}
          setInlineNoticeDesc={setInlineNoticeDesc}
          handleDescChange={handleDescChange}
          applyInlineFormat={applyInlineFormat}
          undo={undo}
          redo={redo}
          historyIndex={historyIndex}
          descHistory={descHistory}
          setDescHistory={setDescHistory}
          setHistoryIndex={setHistoryIndex}
          textareaRef={textareaRef}
        />
      ))}
    </>
  );
}
