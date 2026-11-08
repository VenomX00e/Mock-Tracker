import React, { useState } from 'react';
import { Bot, FileText, Image as ImageIcon, Globe, Copy, Check, ZoomIn } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { RuleCard } from './RuleCard';
import { QuickTestCard } from './QuickTestCard';
import { SeriesPatternCard } from './SeriesPatternCard';
import { ImageLightboxModal } from './ImageLightboxModal';
import { formatModelName } from '../../mocks/SubjectRow';

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
  type: 'markdown' | 'rule_box' | 'series_box' | 'quick_test';
  content: string;
}

function parseMessageSegments(text: string): ContentSegment[] {
  if (!text) return [];

  const segments: ContentSegment[] = [];

  // 1. Unified Structured JSON Block Parser (Matching grammarBlueprint OR seriesBlueprint)
  // Matches ```json ... "grammarBlueprint" ... ``` OR ```json:seriesBlueprint ... ``` OR ```json ... "seriesBlueprint" ... ```
  const jsonCodeblockRegex = /```(?:json(?::seriesBlueprint)?)?\s*([\s\S]*?(?:"grammarBlueprint"|"seriesBlueprint"|seriesBlueprint)[\s\S]*?)\s*```/gi;
  
  // Check for unclosed streaming JSON block that has started outputting blueprint
  const streamingJsonStartRegex = /```(?:json(?::seriesBlueprint)?)?\s*([\s\S]*?(?:"grammarBlueprint"|"seriesBlueprint"|seriesBlueprint)[\s\S]*$)/i;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = jsonCodeblockRegex.exec(text)) !== null) {
    const preText = text.slice(lastIndex, match.index).replace(/^[\s*]+|[\s*]+$/g, '').trim();
    if (preText) {
      segments.push(...splitQuickTest(preText));
    }

    let jsonContent = match[1].trim();
    const isSeries = jsonContent.includes('"seriesBlueprint"') || jsonContent.includes('seriesBlueprint') || match[0].includes('seriesBlueprint');

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
        type: isSeries ? 'series_box' : 'rule_box',
        content: jsonContent,
      });
    }

    if (extractedQt) {
      segments.push(...splitQuickTest(extractedQt));
    }

    lastIndex = match.index + match[0].length;
  }

  // Check if there is an in-progress streaming JSON block that hasn't closed yet in the remaining text
  const remainingSlice = text.slice(lastIndex);
  const openJsonFenceRegex = /```(json(?::seriesBlueprint)?)?\s*([\s\S]*)$/i;
  const streamFenceMatch = openJsonFenceRegex.exec(remainingSlice);

  if (streamFenceMatch && !streamFenceMatch[2].includes('```')) {
    const fenceTag = (streamFenceMatch[1] || '').toLowerCase();
    const streamingBody = streamFenceMatch[2].trim();
    const isSeriesStream =
      fenceTag.includes('seriesblueprint') ||
      streamingBody.includes('"seriesBlueprint"') ||
      streamingBody.includes('seriesBlueprint') ||
      streamingBody.includes('"generatorParams"') ||
      streamingBody.includes('"generatorKey"');
    const isGrammarStream =
      streamingBody.includes('"grammarBlueprint"') ||
      streamingBody.includes('"ruleName"') ||
      streamingBody.includes('"originalSentenceBreakdown"') ||
      (fenceTag === 'json' && (streamingBody.startsWith('{') || streamingBody === ''));

    if (isSeriesStream || isGrammarStream) {
      const before = remainingSlice.slice(0, streamFenceMatch.index).replace(/^[\s*]+|[\s*]+$/g, '').trim();
      if (before) {
        segments.push(...splitQuickTest(before));
      }
      segments.push({
        type: isSeriesStream ? 'series_box' : 'rule_box',
        content: streamingBody,
      });
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
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const isModel = msg.role === 'model';

  const rawUserText = (msg.text || '').trim();
  const isHiddenAttachmentPrompt =
    !isModel &&
    msg.attachments &&
    msg.attachments.length > 0 &&
    (rawUserText === '' ||
      rawUserText === 'Please analyze this attachment.' ||
      /^Please analyze the attached file \(Pages .*\)\.$/i.test(rawUserText));

  const segments = isModel
    ? parseMessageSegments(msg.text || '')
    : isHiddenAttachmentPrompt || !rawUserText
      ? []
      : [{ type: 'markdown' as const, content: msg.text || '' }];

  const handleCopyFullReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!msg.text) return;
    navigator.clipboard.writeText(msg.text);
    setCopiedReply(true);
    setTimeout(() => setCopiedReply(false), 2000);
  };

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

  const totalCitations = msg.citations?.length || 0;
  const INITIAL_VISIBLE_CITATIONS = 3;
  const visibleCitations =
    totalCitations > 0
      ? showAllCitations
        ? msg.citations
        : msg.citations.slice(0, INITIAL_VISIBLE_CITATIONS)
      : [];
  const hiddenCitationsCount = Math.max(0, totalCitations - INITIAL_VISIBLE_CITATIONS);

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start w-full'}`}>
      <div className={`rounded-2xl p-3.5 md:p-4 flex flex-col md:flex-row gap-2.5 md:gap-3 shadow-sm border ${
        msg.role === 'user' 
          ? 'max-w-[88%] md:max-w-[78%] bg-slate-800 dark:bg-slate-700 text-white border-transparent rounded-tr-sm' 
          : 'w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-tl-sm'
      }`}>
        {msg.role === 'model' && (
          <div className="flex-none w-6 h-6 rounded-lg neon-icon-container bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200/60 dark:border-indigo-500/30 flex items-center justify-center mt-0.5">
            <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
        <div className={`markdown-body w-full overflow-hidden text-xs md:text-sm leading-relaxed ${msg.role === 'user' ? 'text-inherit [&_*]:text-inherit w-full' : 'text-slate-800 dark:text-slate-200'}`}>
          {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
            <div className={`${segments.length > 0 ? 'mb-2' : ''} w-fit`}>
              {msg.attachments[0].mimeType !== 'application/pdf' && msg.attachments[0].data ? (() => {
                const imgSrc = `data:${msg.attachments[0].mimeType || 'image/jpeg'};base64,${msg.attachments[0].data}`;
                return (
                  <button
                    type="button"
                    onClick={() => setLightboxImage(imgSrc)}
                    title="Click to view full image"
                    className="relative group block rounded-xl overflow-hidden cursor-zoom-in focus:outline-none"
                  >
                    <img
                      src={imgSrc}
                      alt="Attached"
                      className="max-h-44 md:max-h-52 max-w-[220px] md:max-w-[280px] rounded-xl object-contain border border-white/10 shadow-xs transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-2">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs text-white p-1.5 rounded-lg shadow-sm">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })() : (
                <div className="flex flex-col gap-0.5 bg-slate-900/40 dark:bg-slate-900/60 p-2 rounded-lg w-fit">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                    {msg.attachments[0].mimeType === 'application/pdf' ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    <span>{msg.attachments[0].mimeType === 'application/pdf' ? 'PDF Attached' : 'Image Attached'}</span>
                  </div>
                  {msg.attachments[0].pages && (
                    <span className="text-[10px] text-slate-400 pl-5">Pages: {msg.attachments[0].pages}</span>
                  )}
                </div>
              )}
            </div>
          )}

          <ImageLightboxModal src={lightboxImage} onClose={() => setLightboxImage(null)} />

          {/* Render parsed segments */}
          {segments.map((segment, segIdx) => {
            if (segment.type === 'rule_box') {
              return <RuleCard key={segIdx} content={segment.content} />;
            }
            if (segment.type === 'series_box') {
              return <SeriesPatternCard key={segIdx} content={segment.content} />;
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

          {totalCitations > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/70 flex flex-wrap items-center gap-1.5 text-xs">
              {visibleCitations.map((cit: any, i: number) => (
                <a 
                  key={i} 
                  href={cit.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/40 hover:bg-indigo-50/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 rounded-full transition-colors !no-underline decoration-transparent max-w-[210px]"
                  title={cit.title}
                >
                  <Globe className="w-3 h-3 flex-none text-indigo-500 dark:text-indigo-400" />
                  <span className="truncate !no-underline">{cit.title}</span>
                </a>
              ))}
              {hiddenCitationsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllCitations((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-50/70 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-500/25 border border-indigo-200/70 dark:border-indigo-500/30 transition-colors cursor-pointer"
                >
                  {showAllCitations ? 'Show less' : `+${hiddenCitationsCount} more`}
                </button>
              )}
            </div>
          )}

          {isModel && (msg.modelUsed || msg.text) && (
            <div className="mt-2 pt-1.5 flex items-center justify-end gap-2 text-[10px] text-slate-400 dark:text-slate-500">
              {msg.text && (
                <button
                  type="button"
                  onClick={handleCopyFullReply}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  aria-label="Copy response"
                  title="Copy response"
                >
                  {copiedReply ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
              {msg.text && msg.modelUsed && (
                <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
              )}
              {msg.modelUsed && (
                <span className="font-medium text-slate-400/90 dark:text-slate-500 select-none leading-none">
                  {formatModelName(msg.modelUsed)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

