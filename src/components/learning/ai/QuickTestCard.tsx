import React, { useState, useMemo } from 'react';
import { 
  Zap, Copy, Check, X, MessageSquare, HelpCircle, 
  Sparkles, RefreshCw, CheckCircle2, XCircle, 
  Lightbulb
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface QuickTestCardProps {
  content: string;
  onSendAnswer?: (answer: string) => void;
  disabled?: boolean;
}

interface TestKeyMeta {
  correct: string;
  explanation: string;
  correctSentence?: string;
}

export function QuickTestCard({ content, onSendAnswer, disabled = false }: QuickTestCardProps) {
  const [copied, setCopied] = useState(false);

  // Generate a stable key for this specific question to persist answers across refresh
  const storageKey = useMemo(() => {
    // Hash or normalize the first 120 chars of content
    const sanitized = content.replace(/\[TEST_KEY:[\s\S]*?\]/gi, '').trim();
    let hash = 0;
    for (let i = 0; i < sanitized.length; i++) {
      hash = ((hash << 5) - hash) + sanitized.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return `quick_test_ans_${Math.abs(hash)}`;
  }, [content]);

  const [selectedOption, setSelectedOption] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.selectedOption || null;
      }
    } catch {}
    return null;
  });

  const [isRevealed, setIsRevealed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!parsed.isRevealed;
      }
    } catch {}
    return false;
  });

  // 1. Ultra-robust extraction of answer key, explanation, and correct sentence from the generated content
  const { cleanContent, testKey } = useMemo(() => {
    let rawKey: TestKeyMeta | null = null;
    let cleaned = content;

    // A) Standard JSON format: [TEST_KEY: {"correct": "B", "explanation": "...", "correctSentence": "..."}]
    const jsonKeyRegex = /\[TEST_KEY:\s*(\{[\s\S]*?\})\]/i;
    const jsonMatch = jsonKeyRegex.exec(content);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed && typeof parsed.correct === 'string') {
          rawKey = {
            correct: parsed.correct.trim().toUpperCase().replace(/[^A-E]/g, '') || 'B',
            explanation: parsed.explanation || '',
            correctSentence: parsed.correctSentence || parsed.correctedSentence || parsed.sentence || undefined,
          };
        }
      } catch (e) {
        console.warn('Failed to parse TEST_KEY JSON:', e);
      }
      cleaned = cleaned.replace(jsonMatch[0], '').trim();
    }

    // B) Tagged format fallback: [TEST_KEY: correct="B", explanation="...", correctSentence="..."]
    if (!rawKey) {
      const tagRegex = /\[TEST_KEY:\s*(?:correct=)?\s*["']?([A-E])["']?(?:,\s*explanation=\s*["']?([\s\S]*?)["']?)?(?:,\s*(?:correctSentence|sentence)=\s*["']?([\s\S]*?)["']?)?\]/i;
      const tagMatch = tagRegex.exec(content);
      if (tagMatch) {
        rawKey = {
          correct: tagMatch[1].toUpperCase(),
          explanation: (tagMatch[2] || '').replace(/["']$/, '').trim(),
          correctSentence: tagMatch[3] ? tagMatch[3].replace(/["']$/, '').trim() : undefined,
        };
        cleaned = cleaned.replace(tagMatch[0], '').trim();
      }
    }

    // C) HTML Comment format fallback: <!-- TEST_KEY: {"correct": "B", ...} -->
    if (!rawKey) {
      const commentRegex = /<!--\s*TEST_KEY:\s*(\{[\s\S]*?\})\s*-->/i;
      const commentMatch = commentRegex.exec(content);
      if (commentMatch) {
        try {
          const parsed = JSON.parse(commentMatch[1]);
          if (parsed && typeof parsed.correct === 'string') {
            rawKey = {
              correct: parsed.correct.trim().toUpperCase().replace(/[^A-E]/g, '') || 'B',
              explanation: parsed.explanation || '',
              correctSentence: parsed.correctSentence || parsed.correctedSentence || parsed.sentence || undefined,
            };
          }
        } catch {}
      }
    }

    // D) Answer line fallback: "Answer: (B)" or "**Correct Answer:** B - Reason..."
    if (!rawKey) {
      const ansLineRegex = /(?:\*{0,2}(?:Correct\s+)?Answer\s*(?:Key)?\s*:\s*\*{0,2})\s*(?:\(|\[)?\s*([A-E])\s*(?:\)|\]|\.)?(?:\s*[-–—:]\s*([\s\S]*?))?$/im;
      const ansMatch = ansLineRegex.exec(cleaned);
      if (ansMatch) {
        rawKey = {
          correct: ansMatch[1].toUpperCase(),
          explanation: (ansMatch[2] || '').trim(),
        };
        cleaned = cleaned.replace(ansMatch[0], '').trim();
      }
    }

    // E) Extract explicit "Correct Sentence: ..." if found in cleaned text
    const correctSentenceRegex = /(?:\*{0,2}Correct(?:ed)?\s+Sentence\s*:\s*\*{0,2})\s*(.+)$/im;
    const sentMatch = correctSentenceRegex.exec(cleaned);
    if (sentMatch) {
      if (rawKey) {
        rawKey.correctSentence = sentMatch[1].trim();
      }
      cleaned = cleaned.replace(sentMatch[0], '').trim();
    }

    // Remove any remaining metadata tags from display
    cleaned = cleaned.replace(/\[TEST_KEY:[\s\S]*?\]/gi, '')
                     .replace(/<!--\s*TEST_KEY:[\s\S]*?-->/gi, '')
                     .trim();

    return { cleanContent: cleaned, testKey: rawKey };
  }, [content]);

  // 2. Extract options (A), (B), (C), (D), (E) from the clean text
  const options = useMemo(() => {
    const list: { label: string; text: string }[] = [];
    
    // Check for inline slash or bracketed options: (A) text / (B) text / (C) text / (D) text / (E) No error
    const optionRegex = /(?:\(|\[|\b)([A-E])(?:\)|\]|\.)\s+([^\n\r/|()\[\]]+?)(?=(?:\s*(?:\/|\||\n|\r)?\s*(?:\(|\[|\b)[A-E](?:\)|\]|\.))|$)/gi;
    let match: RegExpExecArray | null;
    
    while ((match = optionRegex.exec(cleanContent)) !== null) {
      const label = match[1].toUpperCase();
      const text = match[2].trim();
      if (text && !list.some(o => o.label === label)) {
        list.push({ label, text });
      }
    }

    // If options were extracted, ensure (E) No error exists if 4 options are found
    if (list.length >= 2) {
      const hasE = list.some(o => o.label === 'E' || o.text.toLowerCase().includes('no error'));
      if (!hasE && list.length === 4) {
        list.push({ label: 'E', text: 'No error' });
      }
      return list;
    }

    // Default fallback: standard exam 5-part options (A, B, C, D, No error)
    return [
      { label: 'A', text: 'Part (A)' },
      { label: 'B', text: 'Part (B)' },
      { label: 'C', text: 'Part (C)' },
      { label: 'D', text: 'Part (D)' },
      { label: 'E', text: 'No error' },
    ];
  }, [cleanContent]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Purely client-side option selection with local persistence!
  const handleSelectOption = (optLabel: string) => {
    if (disabled) return;
    setSelectedOption(optLabel);
    setIsRevealed(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ selectedOption: optLabel, isRevealed: true }));
    } catch {}
  };

  const handleRevealExplanation = () => {
    setIsRevealed(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ selectedOption, isRevealed: true }));
    } catch {}
  };

  const handleReset = () => {
    setSelectedOption(null);
    setIsRevealed(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  // User explicitly asks tutor for deep conversational explanation
  const handleAskTutorToExplain = () => {
    if (!onSendAnswer) return;
    const correctTarget = testKey?.correct || selectedOption || 'the correct option';
    onSendAnswer(`Could you please explain in detail why Part (${correctTarget}) has the error in this sentence and break down the grammatical rules?`);
  };

  // User requests another practice question
  const handleAskNewQuestion = () => {
    if (!onSendAnswer) return;
    onSendAnswer('Give me another practice question for this same grammar rule with the ⚡ Quick Test header, divided into parts (A), (B), (C), (D), (E).');
  };

  const handleQuickHint = () => {
    if (!onSendAnswer) return;
    onSendAnswer('Give me a subtle hint for this Quick Test without revealing the full answer yet.');
  };

  // Target answer fallback (if no test key detected, default to B)
  const targetCorrect = testKey?.correct || 'B';
  const isCorrect = selectedOption ? selectedOption === targetCorrect : null;

  // Derive the full corrected sentence (from metadata or intelligent reconstruction)
  const displayCorrectSentence = useMemo(() => {
    if (testKey?.correctSentence && testKey.correctSentence.trim().length > 0) {
      return testKey.correctSentence.trim();
    }
    
    // Assemble base sentence from option parts
    const baseSentence = options
      .filter(o => o.label !== 'E' && !o.text.toLowerCase().includes('no error'))
      .map(o => o.text.trim())
      .join(' ')
      .replace(/\s+([.,!?;:])/g, '$1')
      .trim();

    // If target is E (No error), the sentence itself is correct
    if (targetCorrect === 'E') {
      return baseSentence;
    }

    // Check if explanation contains "Replace 'X' with 'Y'" or "Change 'X' to 'Y'"
    if (testKey?.explanation && baseSentence) {
      const replaceMatch = /(?:replace|change|use)\s+['"]?([a-zA-Z0-9_\s]+)['"]?\s+(?:with|to|instead\s+of)\s+['"]?([a-zA-Z0-9_\s]+)['"]?/i.exec(testKey.explanation);
      if (replaceMatch) {
        const oldWord = replaceMatch[1].trim();
        const newWord = replaceMatch[2].trim();
        if (oldWord && newWord && baseSentence.includes(oldWord)) {
          return baseSentence.replace(oldWord, newWord);
        }
      }
    }

    return baseSentence || null;
  }, [testKey, targetCorrect, options]);

  return (
    <div className="relative my-3.5 p-4 sm:p-5 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-amber-50/20 dark:from-amber-950/30 dark:via-slate-900/90 dark:to-amber-950/20 border border-amber-300/80 dark:border-amber-700/60 border-dashed rounded-xl shadow-2xs transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-amber-200/70 dark:border-amber-900/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg shadow-2xs font-black">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Active Recall Challenge
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
              ⚡ Quick Test
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isRevealed && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-200/70 dark:hover:bg-amber-900/60 rounded-md transition-colors cursor-pointer"
              title="Reset and try again"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 rounded-md transition-colors cursor-pointer"
            title="Copy test question"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Copied
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium">
                <Copy className="w-3.5 h-3.5" /> Copy
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Test Question Body */}
      <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed space-y-2 font-normal [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_strong]:font-semibold [&_em]:text-amber-800 dark:[&_em]:text-amber-300 [&_em]:font-medium [&_em]:not-italic [&_em]:bg-amber-100/70 dark:[&_em]:bg-amber-900/40 [&_em]:px-1 [&_em]:py-0.5 [&_em]:rounded">
        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {cleanContent}
        </Markdown>
      </div>

      {/* Interactive Options (A, B, C, D, No error) */}
      <div className="mt-3.5 pt-3 border-t border-amber-200/60 dark:border-amber-900/50">
        <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Select the erroneous part:</span>
          </div>
          {!isRevealed && (
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-medium">
              Tap option to verify
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((opt) => {
            const isSelected = selectedOption === opt.label;
            const isTargetCorrect = opt.label === targetCorrect;
            
            // Visual Styling Logic
            let buttonClasses = 'bg-white/95 dark:bg-slate-800/90 hover:bg-amber-100/70 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border-amber-200/80 dark:border-amber-900/60 shadow-2xs hover:shadow-xs';
            let badgeClasses = 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
            let iconElement: React.ReactNode = opt.label;

            if (isRevealed) {
              if (isTargetCorrect) {
                // Correct option -> Bold Vibrant Green!
                buttonClasses = 'bg-emerald-600 dark:bg-emerald-600 text-white font-bold border-emerald-500 shadow-md ring-2 ring-emerald-400/70';
                badgeClasses = 'bg-white text-emerald-700 font-black';
                iconElement = <Check className="w-3.5 h-3.5 stroke-[3]" />;
              } else if (isSelected && !isTargetCorrect) {
                // User picked wrong option -> Bold Vibrant Red!
                buttonClasses = 'bg-rose-600 dark:bg-rose-600 text-white font-bold border-rose-500 shadow-md ring-2 ring-rose-400/70';
                badgeClasses = 'bg-white text-rose-700 font-black';
                iconElement = <X className="w-3.5 h-3.5 stroke-[3]" />;
              } else {
                // Non-selected options when revealed
                buttonClasses = 'opacity-40 bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed';
                badgeClasses = 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
              }
            }

            return (
              <button
                key={opt.label}
                type="button"
                disabled={disabled}
                onClick={() => handleSelectOption(opt.label)}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-xs text-left rounded-lg border transition-all cursor-pointer ${buttonClasses}`}
              >
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-black shrink-0 transition-transform ${badgeClasses}`}>
                  {iconElement}
                </span>
                <span className="truncate flex-1 font-medium">{opt.text}</span>
                {isRevealed && isTargetCorrect && (
                  <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-emerald-800 text-white shrink-0 shadow-xs">
                    Correct
                  </span>
                )}
                {isRevealed && isSelected && !isTargetCorrect && (
                  <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-rose-800 text-white shrink-0 shadow-xs">
                    Wrong
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Integrated Explanation Box directly below options */}
      {isRevealed && (
        <div className={`mt-3.5 p-3.5 rounded-lg border transition-all ${
          isCorrect === true
            ? 'bg-emerald-50/95 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-200'
            : isCorrect === false
            ? 'bg-rose-50/95 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 text-rose-950 dark:text-rose-200'
            : 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200'
        }`}>
          <div className="flex items-start gap-2.5">
            {isCorrect === true ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : isCorrect === false ? (
              <XCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Lightbulb className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1.5 text-xs flex-1">
              <div className="font-bold text-[12.5px] flex items-center gap-1.5">
                <span>
                  {isCorrect === true
                    ? `✓ Correct! Part (${targetCorrect}) is the erroneous part.`
                    : isCorrect === false
                    ? `✗ Incorrect. The error is in Part (${targetCorrect}).`
                    : `💡 Solution: Part (${targetCorrect}) is the error.`}
                </span>
              </div>
              
              {testKey?.explanation ? (
                <div className="text-[11.5px] leading-relaxed opacity-95 font-normal">
                  <span className="font-semibold">Reason: </span>
                  {testKey.explanation}
                </div>
              ) : (
                <div className="text-[11.5px] leading-relaxed opacity-95 font-normal">
                  <span className="font-semibold">Reason: </span>
                  Check subject-verb agreement and trigger words for Part ({targetCorrect}).
                </div>
              )}

              {/* Prominent Correct Sentence Display */}
              {displayCorrectSentence && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-white/95 dark:bg-slate-900/90 border border-emerald-300 dark:border-emerald-700/80 shadow-2xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                    <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" />
                    <span>Correct Sentence</span>
                  </div>
                  <div className="text-[12px] sm:text-[12.5px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed select-text font-sans">
                    {displayCorrectSentence}
                  </div>
                </div>
              )}

              {/* Action Buttons inside Explanation Box */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleAskTutorToExplain}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3 text-indigo-500" />
                  <span>Explain in detail in chat</span>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleAskNewQuestion}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-amber-500 text-slate-950 rounded-md hover:bg-amber-400 transition-colors shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Try another question</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-reveal action chips */}
      {!isRevealed && (
        <div className="mt-3 pt-2.5 border-t border-amber-200/50 dark:border-amber-900/40 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={handleRevealExplanation}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-100/70 dark:bg-amber-900/40 hover:bg-amber-200/70 dark:hover:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded-md transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/40 disabled:opacity-50"
          >
            <Lightbulb className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Explain / Reveal Answer</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={handleQuickHint}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-100/70 dark:bg-amber-900/40 hover:bg-amber-200/70 dark:hover:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded-md transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/40 disabled:opacity-50"
          >
            <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Give Hint</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectOption('E')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-100/70 dark:bg-amber-900/40 hover:bg-amber-200/70 dark:hover:bg-amber-800/50 text-amber-800 dark:text-amber-200 rounded-md transition-colors cursor-pointer border border-amber-200/60 dark:border-amber-800/40 disabled:opacity-50"
          >
            <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>No Error</span>
          </button>
        </div>
      )}
    </div>
  );
}
