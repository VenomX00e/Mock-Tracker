import React, { useState } from 'react';
import { Bot, FileText, Image as ImageIcon, Globe, Copy, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function getTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.children) {
    return node.children.map(getTextFromNode).join('');
  }
  return '';
}

function getAnnotationText(node: any): string {
  if (!node) return '';
  if (node.tagName === 'annotation' && node.properties?.encoding === 'application/x-tex') {
    return getTextFromNode(node);
  }
  if (node.children) {
    for (const child of node.children) {
      const found = getAnnotationText(child);
      if (found) return found;
    }
  }
  return '';
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={className} aria-label="Copy to clipboard">
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export interface ChatMessageProps {
  msg: any;
  idx: number;
  setActiveTab: (tab: any) => void;
}

export function ChatMessage({ msg, idx, setActiveTab }: ChatMessageProps) {
  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl p-3 md:p-4 flex flex-col md:flex-row gap-2 md:gap-3 shadow-sm border ${
        msg.role === 'user' 
          ? 'bg-slate-800 dark:bg-slate-700 text-white border-transparent rounded-tr-sm' 
          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-tl-sm'
      }`}>
        {msg.role === 'model' && (
          <div className="flex-none w-5 h-5 md:w-6 md:h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mt-0.5">
            <Bot className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
        <div className={`markdown-body w-full overflow-hidden text-xs md:text-sm leading-relaxed ${msg.role === 'user' ? 'text-inherit [&_*]:text-inherit w-full' : 'text-slate-800 dark:text-slate-200'}`}>
          {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-col gap-0.5 mb-2 bg-slate-900/40 dark:bg-slate-900/60 p-2 rounded-lg w-fit">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                {msg.attachments[0].mimeType === 'application/pdf' ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                <span>{msg.attachments[0].mimeType === 'application/pdf' ? 'PDF Attached' : 'Image Attached'}</span>
              </div>
              {msg.attachments[0].pages && (
                <span className="text-[10px] text-slate-400 pl-5">Pages: {msg.attachments[0].pages}</span>
              )}
            </div>
          )}
          <Markdown 
            remarkPlugins={[remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            components={{
              span: ({node, className, children, ...props}: any) => {
                if (className === 'katex-display') {
                  const tex = getAnnotationText(node);
                  return (
                    <div className="relative group my-4 text-center">
                      <span className={className} {...props}>{children}</span>
                      {tex && (
                        <CopyButton 
                          text={tex} 
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 p-1.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700"
                        />
                      )}
                    </div>
                  );
                }
                return <span className={className} {...props}>{children}</span>;
              },
              pre: ({ children, node, ...props }) => {
                return (
                  <div className="relative group my-4">
                    <pre {...props} className="bg-slate-900 text-slate-50 p-4 rounded-xl overflow-x-auto text-sm font-mono border border-slate-700/50">
                      {children}
                    </pre>
                    {node && (
                      <CopyButton 
                        text={getTextFromNode(node)} 
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-md"
                      />
                    )}
                  </div>
                );
              },
              code: ({node, inline, className, children, ...props}: any) => {
                if (inline) {
                  return <code className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
                }
                return <code className={`${className} font-mono`} {...props}>{children}</code>;
              },
              a: ({node, href, children, ...props}) => {
                if (href && href.startsWith('/')) {
                  return (
                    <button
                      onClick={() => {
                        const tabMap: Record<string, string> = {
                          '/action-items': 'tasks',
                          '/actions': 'tasks',
                          '/tasks': 'tasks',
                          '/dashboard': 'dashboard',
                          '/home': 'home',
                          '/community': 'community',
                          '/admin': 'admin',
                          '/countdowns': 'countdowns',
                          '/profile': 'profile',
                          '/learning': 'learning',
                          '/mock tests': 'dashboard',
                          '/mocks': 'dashboard',
                          '/mock-tests': 'dashboard',
                        };
                        const normalizedHref = href.toLowerCase();
                        const tab = tabMap[normalizedHref] || normalizedHref.slice(1);
                        setActiveTab(tab as any);
                      }}
                      className="inline-flex mt-2 mb-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg no-underline transition-colors shadow-sm items-center justify-center cursor-pointer"
                    >
                      {children}
                    </button>
                  );
                }
                return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline" {...props}>{children}</a>;
              }
            }}
          >
            {msg.text}
          </Markdown>
          {msg.citations && msg.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 text-xs">
              {msg.citations.map((cit: any, i: number) => (
                <a 
                  key={i} 
                  href={cit.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded transition-colors no-underline truncate max-w-[200px]"
                  title={cit.title}
                >
                  <Globe className="w-3 h-3 flex-none" />
                  <span className="truncate">[{i + 1}] {cit.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
