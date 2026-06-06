import React, { useRef, useEffect } from 'react';
import { Megaphone, Save, X as XIcon, Undo, Redo, Pin, Bold, Italic, Link as LinkIcon, ArrowRight, Pencil, Eraser } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface NoticeCardProps {
  notice: any;
  isAdmin: boolean;
  canManageNotices: boolean;
  isPinned: boolean;
  togglePinNotice: (id: string, e: React.MouseEvent, canManageNotices: boolean) => void;
  activeNoticeId: string | null;
  setActiveNoticeId: React.Dispatch<React.SetStateAction<string | null>>;
  inlineEditingId: string | null;
  setInlineEditingId: (id: string | null) => void;
  saveInlineNotice: (id: string) => void;
  inlineNoticeTitle: string;
  setInlineNoticeTitle: (val: string) => void;
  inlineNoticeDesc: string;
  setInlineNoticeDesc: (val: string) => void;
  handleDescChange: (val: string) => void;
  applyInlineFormat: (before: string, after?: string) => void;
  undo: () => void;
  redo: () => void;
  historyIndex: number;
  descHistory: string[];
  setDescHistory: (history: string[]) => void;
  setHistoryIndex: (index: number) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export const NoticeCard: React.FC<NoticeCardProps> = ({
  notice: n,
  isAdmin,
  canManageNotices,
  isPinned,
  togglePinNotice,
  activeNoticeId,
  setActiveNoticeId,
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
  textareaRef,
}) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const parseRawToHtml = (raw: string) => {
    if (!raw) return '';
    let html = raw;
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/&lt;re?d&gt;([\s\S]*?)&lt;\/re?d&gt;/gi, '<span style="color: #ef4444" class="temp-color-red font-semibold">$1</span>');
    html = html.replace(/&lt;bl(?:ue)?&gt;([\s\S]*?)&lt;\/bl(?:ue)?&gt;/gi, '<span style="color: #3b82f6" class="temp-color-blue font-semibold">$1</span>');
    html = html.replace(/&lt;gr(?:een)?&gt;([\s\S]*?)&lt;\/gr(?:een)?&gt;/gi, '<span style="color: #10b981" class="temp-color-green font-semibold">$1</span>');
    html = html.replace(/&lt;am(?:ber)?&gt;([\s\S]*?)&lt;\/am(?:ber)?&gt;/gi, '<span style="color: #f59e0b" class="temp-color-amber font-semibold">$1</span>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4f46e5; text-decoration: underline;">$1</a>');
    return html.split('\n').join('<br>');
  };

  const parseHtmlToRaw = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        let inner = Array.from(el.childNodes).map(processNode).join('');
        
        if (tagName === 'b' || tagName === 'strong') {
          return `**${inner}**`;
        }
        if (tagName === 'i' || tagName === 'em') {
          return `*${inner}*`;
        }
        if (tagName === 'font' || tagName === 'span') {
          const color = (el.getAttribute('color') || el.style.color || '').toLowerCase().replace(/\s/g, '');
          const classes = el.className || '';
          if (color === '#ef4444' || color === 'rgb(239,68,68)' || classes.includes('temp-color-red')) return `<rd>${inner}</rd>`;
          if (color === '#3b82f6' || color === 'rgb(59,130,246)' || classes.includes('temp-color-blue')) return `<bl>${inner}</bl>`;
          if (color === '#10b981' || color === 'rgb(16,185,129)' || classes.includes('temp-color-green')) return `<gr>${inner}</gr>`;
          if (color === '#f59e0b' || color === 'rgb(245,158,11)' || classes.includes('temp-color-amber')) return `<am>${inner}</am>`;
          return inner;
        }
        if (tagName === 'a') {
          const href = el.getAttribute('href') || '#';
          return `[${inner}](${href})`;
        }
        if (tagName === 'br') {
          return '\n';
        }
        if (tagName === 'div' || tagName === 'p') {
          if (el.childNodes.length === 1 && el.childNodes[0].nodeName.toLowerCase() === 'br') {
             return '\n';
          }
          return `\n${inner}`;
        }
        return inner;
      }
      return '';
    };
    
    let result = processNode(temp);
    return result.replace(/^\n/, '');
  };

  useEffect(() => {
    if (inlineEditingId === n.id && contentEditableRef.current) {
      const currentRaw = parseHtmlToRaw(contentEditableRef.current.innerHTML);
      if (currentRaw !== inlineNoticeDesc) {
        contentEditableRef.current.innerHTML = parseRawToHtml(inlineNoticeDesc || '');
      }
    }
  }, [inlineEditingId, n.id, inlineNoticeDesc]);

  const handleRemoveStyle = (e: React.MouseEvent) => {
    e.preventDefault();
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());
      
      const tags = container.querySelectorAll('span, b, strong, i, em, font, a');
      tags.forEach(t => {
        const parent = t.parentNode;
        if (parent) {
          while (t.firstChild) {
            parent.insertBefore(t.firstChild, t);
          }
          parent.removeChild(t);
        }
      });
      
      document.execCommand('insertHTML', false, container.innerHTML);
    }
  };

  const applyColorTarget = (e: React.MouseEvent, hexColor: string, colorClass: string) => {
    e.preventDefault();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const container = document.createElement('div');
      container.appendChild(range.cloneContents());
      const html = container.innerHTML;
      document.execCommand('insertHTML', false, `<span style="color: ${hexColor}" class="${colorClass}">${html}</span>`);
    }
  };

  const u = n.urgency || 'info';
  const configs: Record<string, any> = {
    warning: {
      bg: 'from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/10 dark:via-yellow-900/10 dark:to-amber-900/10 border-amber-100 dark:border-amber-900/30',
      icon: 'text-amber-900 dark:text-amber-500',
      pill: 'bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400',
      button: 'text-amber-900 bg-amber-200 hover:bg-amber-300'
    },
    info: {
      bg: 'from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-blue-900/10 border-blue-100 dark:border-blue-900/30',
      icon: 'text-blue-900 dark:text-blue-500',
      pill: 'bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400',
      button: 'text-blue-900 bg-blue-200 hover:bg-blue-300'
    },
    error: {
      bg: 'from-red-50 via-rose-50 to-red-50 dark:from-red-900/10 dark:via-rose-900/10 dark:to-red-900/10 border-red-100 dark:border-red-900/30',
      icon: 'text-red-900 dark:text-red-500',
      pill: 'bg-red-200 dark:bg-red-500/20 text-red-800 dark:text-red-400',
      button: 'text-red-900 bg-red-200 hover:bg-red-300'
    }
  };
  
  const c = configs[u] || configs.info;
  
  let textWithLinks = n.description ? n.description.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1[$2]($2)') : '';
  textWithLinks = textWithLinks
      .replace(/<re?d>([\s\S]*?)<\/re?d>/gi, '<span class="text-red-500 font-semibold">$1</span>')
      .replace(/<bl(?:ue)?>([\s\S]*?)<\/bl(?:ue)?>/gi, '<span class="text-blue-500 font-semibold">$1</span>')
      .replace(/<gr(?:een)?>([\s\S]*?)<\/gr(?:een)?>/gi, '<span class="text-emerald-500 font-semibold">$1</span>')
      .replace(/<am(?:ber)?>([\s\S]*?)<\/am(?:ber)?>/gi, '<span class="text-amber-500 font-semibold">$1</span>');

  return (
    <div 
      key={n.id} 
      className={`mb-5 mt-0 p-[12px] rounded-2xl bg-gradient-to-r ${c.bg} border shadow-sm relative overflow-hidden notice-card-container ${(canManageNotices || n.editableBy === 'users') ? 'cursor-pointer' : ''}`}
      onClick={(e) => {
        if (canManageNotices || n.editableBy === 'users') {
          setActiveNoticeId(prev => prev === n.id ? null : n.id);
        }
      }}
    >
      <div className={`absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 pointer-events-none`}>
        <Megaphone className={`w-32 h-32 ${c.icon}`} />
      </div>
      {inlineEditingId === n.id ? (
         <div onClick={(e) => e.stopPropagation()} className="relative z-20 w-full flex flex-col gap-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm ">
           <div className="flex items-center justify-between">
             <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Inline Editing</h3>
             <div className="flex gap-2">
               <button onClick={() => saveInlineNotice(n.id)} className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-colors" title="Save changes">
                 <Save className="w-4 h-4" />
               </button>
               <button onClick={() => setInlineEditingId(null)} className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-md transition-colors" title="Cancel">
                 <XIcon className="w-4 h-4" />
               </button>
             </div>
           </div>
           <input
             type="text"
             value={inlineNoticeTitle}
             onChange={e => setInlineNoticeTitle(e.target.value)}
             className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100"
             placeholder="Notice Title"
           />
           <div
             ref={contentEditableRef}
             contentEditable
             suppressContentEditableWarning
             onInput={(e) => {
               const html = e.currentTarget.innerHTML;
               const raw = parseHtmlToRaw(html);
               handleDescChange(raw);
             }}
             className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 min-h-[100px] outline-none focus:ring-2 focus:ring-indigo-500 max-h-[300px] overflow-y-auto"
           />
           <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
             <button onPointerDown={(e) => e.preventDefault()} onClick={undo} disabled={historyIndex <= 0 && inlineNoticeDesc === descHistory[historyIndex]} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-50" title="Undo"><Undo className="w-4 h-4" /></button>
             <button onPointerDown={(e) => e.preventDefault()} onClick={redo} disabled={historyIndex >= descHistory.length - 1} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:opacity-50" title="Redo"><Redo className="w-4 h-4" /></button>
             <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
             <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false); }} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Bold"><Bold className="w-4 h-4" /></button>
             <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false); }} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Italic"><Italic className="w-4 h-4" /></button>
             <button onMouseDown={(e) => { e.preventDefault(); const url = prompt('Enter link URL:', 'https://'); if(url) document.execCommand('createLink', false, url); }} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Link"><LinkIcon className="w-4 h-4" /></button>
             <button onMouseDown={handleRemoveStyle} className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Remove Style"><Eraser className="w-4 h-4" /></button>
             <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-3"></div>
             <button onMouseDown={(e) => applyColorTarget(e, '#ef4444', 'temp-color-red font-semibold')} className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50">Red</button>
             <button onMouseDown={(e) => applyColorTarget(e, '#3b82f6', 'temp-color-blue font-semibold')} className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50">Blue</button>
             <button onMouseDown={(e) => applyColorTarget(e, '#10b981', 'temp-color-green font-semibold')} className="px-2 py-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 rounded border border-emerald-200 dark:border-emerald-900/50">Green</button>
             <button onMouseDown={(e) => applyColorTarget(e, '#f59e0b', 'temp-color-amber font-semibold')} className="px-2 py-1 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-900/50">Amber</button>
           </div>
         </div>
      ) : (
      <div className="relative z-10 w-full flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-2 pr-8">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] uppercase font-bold tracking-wider animate-notice-tag-pulse shrink-0 ${c.pill}`}>{n.urgency ? `Notice: ${n.urgency === 'error' ? 'Urgent' : n.urgency}` : 'Notice'}</span>
            </div>
            <h2 className="text-[17px] sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{n.title}</h2>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {n.tags && n.tags.length > 0 && n.tags.map((tag: string, i: number) => (
                <span key={i} className="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[10px] sm:text-xs font-medium bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 shrink-0">
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          </div>
          {n.description && (
            <div className="text-slate-700 dark:text-slate-300 text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap markdown-body mt-2">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw as any]}
                components={{
                  a: ({node, ...props}) => {
                     if (props.href?.startsWith('#')) {
                         return <span className={`font-semibold ${c.icon}`}>{props.children}</span>
                     }
                     return <a {...props} onClick={(e) => e.stopPropagation()} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium" target="_blank" rel="noopener noreferrer" />
                  },
                  ul: ({node, ...props}) => <ul {...props} className="list-disc pl-5 my-2" />,
                  ol: ({node, ...props}) => <ol {...props} className="list-decimal pl-5 my-2" />,
                  p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />,
                  strong: ({node, ...props}) => <strong {...props} className="font-bold text-slate-900 dark:text-white" />
                }}
              >{textWithLinks}</Markdown>
            </div>
          )}
          {isAdmin && n.lastEditedByEmail && (
            <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 font-medium italic">
              Last edited by: {n.lastEditedByEmail}
            </div>
          )}
        </div>
        {n.link && (
          <div className="flex-shrink-0 mt-2 md:mt-0">
            <a
              href={n.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium transition-all rounded-xl hover:shadow-md ${c.button}`}
            >
              View Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </div>
        )}
      </div>
      )}
      {(activeNoticeId === n.id && inlineEditingId !== n.id) && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {canManageNotices && (
            <button
              onClick={(e) => togglePinNotice(n.id, e, canManageNotices)}
              className={`p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95 ${isPinned ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
              title={isPinned ? "Unpin Notice" : "Pin Notice"}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInlineEditingId(n.id);
              setInlineNoticeTitle(n.title || '');
              setInlineNoticeDesc(n.description || '');
              setDescHistory([n.description || '']);
              setHistoryIndex(0);
            }}
            className="p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-110 active:scale-95"
            title={canManageNotices ? "Edit Notice Inline" : "Edit Notice"}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

