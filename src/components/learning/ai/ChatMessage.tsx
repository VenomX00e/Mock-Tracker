import React, { useState } from 'react';
import { Bot, FileText, Image as ImageIcon, Globe, Copy, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { RuleCard } from './RuleCard';
import { QuickTestCard } from './QuickTestCard';

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

interface ContentSegment {
  type: 'markdown' | 'rule_box' | 'quick_test';
  content: string;
}

function parseMessageSegments(text: string): ContentSegment[] {
  if (!text) return [];

  const segments: ContentSegment[] = [];

  // 1. Primary Structured JSON Block Parser (Matching ```json ... "grammarBlueprint" ... ```)
  // Extract the complete block inside code fences when closed, or streaming block when unclosed
  const jsonCodeblockRegex = /```(?:json)?\s*([\s\S]*?"grammarBlueprint"[\s\S]*?)\s*```/gi;
  
  // Check for unclosed streaming JSON block that has started outputting "grammarBlueprint"
  const streamingJsonStartRegex = /```(?:json)?\s*([\s\S]*?"grammarBlueprint"[\s\S]*$)/i;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = jsonCodeblockRegex.exec(text)) !== null) {
    const preText = text.slice(lastIndex, match.index).replace(/^[\s*]+|[\s*]+$/g, '').trim();
    if (preText) {
      segments.push(...splitQuickTest(preText));
    }

    let jsonContent = match[1].trim();

    // If the JSON block swallowed the subsequent Quick Test, cleanly isolate it
    const quickTestInsideRegex = /(?:^|\n)(?=(?:\d+\.\s*)?\*{0,2}⚡\s*Quick Test[\s\S]*?:?|(?:###?\s*)?⚡\s*Quick Test[\s\S]*?:?|\[TEST_KEY:)/i;
    const qtMatch = quickTestInsideRegex.exec(jsonContent);
    let extractedQt: string | null = null;
    if (qtMatch && qtMatch.index !== undefined && qtMatch.index > 0) {
      extractedQt = jsonContent.slice(qtMatch.index).trim();
      jsonContent = jsonContent.slice(0, qtMatch.index).trim();
    }

    if (jsonContent) {
      segments.push({
        type: 'rule_box',
        content: jsonContent,
      });
    }

    if (extractedQt) {
      segments.push(...splitQuickTest(extractedQt));
    }

    lastIndex = match.index + match[0].length;
  }

  // Check if there is an in-progress streaming JSON block that hasn't closed yet
  if (lastIndex === 0 && segments.length === 0) {
    const streamMatch = streamingJsonStartRegex.exec(text);
    if (streamMatch) {
      const before = text.slice(0, streamMatch.index).trim();
      const streamingContent = streamMatch[1].trim();
      if (before) {
        segments.push(...splitQuickTest(before));
      }
      if (streamingContent) {
        segments.push({
          type: 'rule_box',
          content: streamingContent,
        });
      }
      return segments;
    }
  }

  // 2. Backward Compatibility: Support legacy [RULE_BOX_START] / [GRAMMAR_BOX_START] tags if received
  if (segments.length === 0) {
    const legacyRuleBoxRegex = /(?:[`*]*\[\s*(?:RULE|GRAMMAR)[_\-\s]*BOX[_\-\s]*START\s*\][`*]*)([\s\S]*?)(?:[`*]*\[\s*(?:RULE|GRAMMAR)[_\-\s]*BOX[_\-\s]*END\s*\][`*]*|$)/gi;
    let legacyLastIndex = 0;
    let legacyMatch: RegExpExecArray | null;

    while ((legacyMatch = legacyRuleBoxRegex.exec(text)) !== null) {
      const preText = text.slice(legacyLastIndex, legacyMatch.index).replace(/^[\s*]+|[\s*]+$/g, '').trim();
      if (preText) {
        segments.push(...splitQuickTest(preText));
      }

      let ruleContent = legacyMatch[1].trim();
      const quickTestInsideRegex = /(?:^|\n)(?=(?:\d+\.\s*)?\*{0,2}⚡\s*Quick Test:?|(?:###?\s*)?⚡\s*Quick Test:?|\[TEST_KEY:)/i;
      const qtMatch = quickTestInsideRegex.exec(ruleContent);
      let extractedQt: string | null = null;
      if (qtMatch && qtMatch.index !== undefined && qtMatch.index > 0) {
        extractedQt = ruleContent.slice(qtMatch.index).trim();
        ruleContent = ruleContent.slice(0, qtMatch.index).trim();
      }

      if (ruleContent) {
        segments.push({
          type: 'rule_box',
          content: ruleContent,
        });
      }

      if (extractedQt) {
        segments.push(...splitQuickTest(extractedQt));
      }

      legacyLastIndex = legacyMatch.index + legacyMatch[0].length;
    }

    if (segments.length > 0) {
      const remaining = text.slice(legacyLastIndex).replace(/^[\s*]+|[\s*]+$/g, '').trim();
      if (remaining) {
        segments.push(...splitQuickTest(remaining));
      }
      return segments;
    }
  }

  const remaining = text.slice(lastIndex).replace(/^[\s*]+|[\s*]+$/g, '').trim();
  if (remaining) {
    segments.push(...splitQuickTest(remaining));
  }

  return segments.length > 0 ? segments : [{ type: 'markdown', content: text }];
}

function splitQuickTest(text: string): ContentSegment[] {
  if (!text) return [];

  // 1. Explicit Quick Test heading match (e.g., "5. **⚡ Quick Test:**" or "⚡ Quick Test (Active Recall):")
  const quickTestHeaderRegex = /(?:^|\n)(?:(?:\d+\.\s*)?\*{0,2}⚡\s*Quick Test[\w\s()]*:?\*{0,2}|(?:###?\s*)?⚡\s*Quick Test[\w\s()]*:?)\s*([\s\S]*)$/i;
  const headerMatch = quickTestHeaderRegex.exec(text);

  if (headerMatch) {
    const before = text.slice(0, headerMatch.index).trim();
    const testBody = headerMatch[1]?.trim() || '';

    const results: ContentSegment[] = [];
    if (before) {
      results.push({ type: 'markdown', content: before });
    }
    if (testBody) {
      results.push({ type: 'quick_test', content: testBody });
    }
    return results.length > 0 ? results : [{ type: 'markdown', content: text }];
  }

  // 2. Embedded [TEST_KEY: ...] tag match
  if (text.includes('[TEST_KEY:') || /<!--\s*TEST_KEY:/i.test(text)) {
    // Find where the question starts, usually starting with (A) or the first option
    const qStartRegex = /(?:^|\n)(?=(?:\(?A\)?|[A-E]\.|\bPart\s+A\b))/i;
    const qMatch = qStartRegex.exec(text);
    if (qMatch && qMatch.index !== undefined && qMatch.index > 0) {
      const before = text.slice(0, qMatch.index).trim();
      const testBody = text.slice(qMatch.index).trim();
      const results: ContentSegment[] = [];
      if (before) {
        results.push({ type: 'markdown', content: before });
      }
      results.push({ type: 'quick_test', content: testBody });
      return results;
    }

    return [{ type: 'quick_test', content: text.trim() }];
  }

  // 3. Detect bare 4/5-option sentence questions like (A) ... (B) ... (C) ... (D) ...
  const bareOptionsRegex = /(?:\(?A\)[^/]+(?:\/|\s)\(?B\)[^/]+(?:\/|\s)\(?C\)[^/]+(?:\/|\s)\(?D\))/i;
  if (bareOptionsRegex.test(text)) {
    const qStartRegex = /(?:^|\n)(?=(?:\(?A\)?|[A-E]\.|\bPart\s+A\b))/i;
    const qMatch = qStartRegex.exec(text);
    if (qMatch && qMatch.index !== undefined && qMatch.index > 0) {
      const before = text.slice(0, qMatch.index).trim();
      const testBody = text.slice(qMatch.index).trim();
      const results: ContentSegment[] = [];
      if (before) {
        results.push({ type: 'markdown', content: before });
      }
      results.push({ type: 'quick_test', content: testBody });
      return results;
    }
    return [{ type: 'quick_test', content: text.trim() }];
  }

  return [{ type: 'markdown', content: text }];
}

export interface ChatMessageProps {
  msg: any;
  idx: number;
  setActiveTab: (tab: any) => void;
  onSendAnswer?: (answer: string) => void;
  isLoading?: boolean;
}

export function ChatMessage({ msg, idx, setActiveTab, onSendAnswer, isLoading = false }: ChatMessageProps) {
  const isModel = msg.role === 'model';
  const segments = isModel ? parseMessageSegments(msg.text || '') : [{ type: 'markdown' as const, content: msg.text || '' }];

  const markdownComponents = {
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
    pre: ({ children, node, ...props }: any) => {
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
    a: ({node, href, children, ...props}: any) => {
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
  };

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

          {/* Render parsed segments */}
          {segments.map((segment, segIdx) => {
            if (segment.type === 'rule_box') {
              return <RuleCard key={segIdx} content={segment.content} />;
            }
            if (segment.type === 'quick_test') {
              return <QuickTestCard key={segIdx} content={segment.content} onSendAnswer={onSendAnswer} disabled={isLoading} />;
            }
            return (
              <Markdown 
                key={segIdx}
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
              >
                {segment.content}
              </Markdown>
            );
          })}

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

