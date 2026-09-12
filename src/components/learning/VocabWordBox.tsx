import React, { useState, useRef, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { VocabEntry, useVocabularyStore } from "../../store/vocabularyStore";
import {
  CheckCircle,
  Circle,
  Volume2,
  X,
  Lightbulb,
  Trash2,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  Folder,
} from "lucide-react";
import { generateWordDetails } from "../../services/aiService";
import { MoveVocabDialog } from "./MoveVocabDialog";

interface VocabWordBoxProps {
  vocab: VocabEntry;
  onUpdate: (updates: Partial<VocabEntry>) => void;
  onDelete: () => void;
  canManageLearning?: boolean;
  isMyVocabsView?: boolean;
}

import { getActiveApiKey } from '../../utils/apiKeyManager';

export function VocabWordBox({
  vocab,
  onUpdate,
  onDelete,
  canManageLearning = false,
  isMyVocabsView = false,
}: VocabWordBoxProps) {
  // Store actions and state for favorites
  const favoriteVocabIds = useVocabularyStore((state) => state.favoriteVocabIds);
  const customFolders = useVocabularyStore((state) => state.customFolders);
  const toggleFavorite = useVocabularyStore((state) => state.toggleFavorite);
  const isStarred = favoriteVocabIds.includes(vocab.id);
  const isInCustomFolder = customFolders.some((f) => (f.vocabIds || []).includes(vocab.id));

  // Move dialog state
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);

  // Local toast message for instant feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // We use local state for editing arrays to avoid jumping cursor issues while typing
  const [synonyms, setSynonyms] = useState(vocab.synonyms.join(", "));
  const [antonyms, setAntonyms] = useState(vocab.antonyms.join(", "));
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isPosOpen, setIsPosOpen] = useState(false);
  const posRef = useRef<HTMLDivElement>(null);
  const [isGeneratingDetails, setIsGeneratingDetails] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [isAddExpanded, setIsAddExpanded] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const willBeStarred = !isStarred;
    toggleFavorite(vocab.id);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(willBeStarred ? "Added to Favorites" : "Removed from Favorites");
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setShowDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleGenerateDetails = async () => {
    if (!vocab.word || !vocab.word.trim()) return;
    if (!getActiveApiKey()) {
      alert(
        "Please configure your Gemini API Key in the AI Settings (top right on Learning page).",
      );
      return;
    }
    try {
      setIsGeneratingDetails(true);
      const data = await generateWordDetails(vocab.word.trim());
      onUpdate({
        meaning: data.meaning || vocab.meaning || "",
        mnemonic: data.mnemonic || vocab.mnemonic || "",
      });
    } catch (err: any) {
      alert(err.message || "Failed to generate details");
    } finally {
      setIsGeneratingDetails(false);
    }
  };

  // Close popup on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setIsPopupOpen(false);
      }
      if (posRef.current && !posRef.current.contains(event.target as Node)) {
        setIsPosOpen(false);
      }
    }
    if (isPopupOpen || isPosOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopupOpen, isPosOpen]);

  return (
    <div
      ref={boxRef}
      onClick={() => setShowDelete(true)}
      className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-300 relative group
        ${
          vocab.isMastered
            ? "bg-emerald-50/50 border-emerald-200 opacity-80 dark:bg-emerald-900/10 dark:border-emerald-800/50 dark:opacity-75 hover:opacity-100"
            : "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300 dark:focus-within:border-indigo-500/50 dark:focus-within:ring-indigo-500/50"
        }
      `}
    >
      {/* Actions */}
      <div className="absolute top-2.5 right-2 md:right-3 flex items-center gap-1 transition-opacity z-10 pointer-events-auto">
        {/* Toast Notification Pill */}
        {toastMessage && (
          <div className="px-2.5 py-1 bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-semibold rounded-full shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-right-2 duration-200">
            {toastMessage}
          </div>
        )}

        {/* Save to Personal Section / Custom Folder Button */}
        {isMyVocabsView && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMoveDialogOpen(true);
            }}
            className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
              isInCustomFolder
                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title="Save to personal section..."
          >
            <Folder
              className={`w-4 h-4 md:w-4.5 md:h-4.5 transition-transform active:scale-125 ${
                isInCustomFolder ? "fill-indigo-500/20" : ""
              }`}
            />
          </button>
        )}

        {/* Favorite Star Button */}
        <button
          type="button"
          onClick={handleToggleStar}
          className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            isStarred
              ? "text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60"
              : "text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Star
            className={`w-4 h-4 md:w-4.5 md:h-4.5 transition-transform active:scale-125 ${
              isStarred ? "fill-amber-400 text-amber-500" : ""
            }`}
          />
        </button>

        {canManageLearning && showDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 px-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm animate-in fade-in zoom-in"
            title="Delete Word"
          >
            Delete
          </button>
        )}
      </div>

      {/* Row 1: Word and POS */}
      <div className={`flex items-center gap-1.5 w-full ${isMyVocabsView ? 'pr-[98px] md:pr-[110px]' : 'pr-[72px] md:pr-[84px]'} flex-nowrap`}>
        <button
          onClick={() => onUpdate({ isMastered: !vocab.isMastered })}
          className="p-0.5 text-slate-400 hover:text-green-600 dark:hover:text-green-500 rounded-md transition-colors shrink-0"
          title="Mark as Mastered"
        >
          {vocab.isMastered ? (
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500 px-0 -ml-2.5 -mr-1" />
          ) : (
            <Circle className="w-4 h-4 md:w-5 md:h-5 px-0 -ml-2.5 -mr-1" />
          )}
        </button>

        <div className="relative shrink min-w-0 flex items-center overflow-hidden">
          <span className="invisible whitespace-pre text-xl md:text-2xl font-bold min-w-[2ch]">
            {vocab.word || "Word"}
          </span>
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="text"
            value={vocab.word}
            onChange={(e) => onUpdate({ word: e.target.value })}
            onClick={() => setIsPopupOpen(true)}
            readOnly={!canManageLearning}
            placeholder="Word"
            title="Click to open word details"
            className={`absolute inset-0 w-full h-full text-xl md:text-2xl font-bold bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer
              ${vocab.isMastered ? "text-green-900 dark:text-green-100" : "text-slate-900 dark:text-slate-100"}
            `}
          />
        </div>
        <div className="relative flex-none mt-1" ref={posRef}>
          <button
            onClick={(e) => {
              if (canManageLearning) {
                e.stopPropagation();
                setIsPosOpen(!isPosOpen);
              }
            }}
            className={`text-[10px] md:text-[11px] font-bold uppercase tracking-wider px-2 md:px-2.5 py-1 rounded-md outline-none ${canManageLearning ? "cursor-pointer" : "cursor-default"} transition-colors text-center shadow-sm min-w-[42px] md:min-w-[48px]
              ${
                vocab.isMastered
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30"
                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/20"
              }
            `}
          >
            {vocab.pos || "POS"}
          </button>

          {isPosOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-24 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in zoom-in-95 font-medium">
              {["Noun", "Verb", "Adj", "Adv", "Prep", "Pron"].map((pos) => (
                <button
                  key={pos}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ pos });
                    setIsPosOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-wider"
                >
                  {pos}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popup / Popover */}
      {isPopupOpen && (
        <div
          ref={popupRef}
          className="absolute z-20 left-4 top-14 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 animate-in fade-in zoom-in-95 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1">
                {vocab.word || "Word"}
              </span>
              <button
                onClick={() => {
                  if (vocab.word) {
                    const utterance = new SpeechSynthesisUtterance(vocab.word);
                    window.speechSynthesis.speak(utterance);
                  }
                }}
                className="p-1.5 text-slate-500 bg-slate-100 dark:bg-slate-800 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/20 rounded-lg transition-colors shadow-sm"
                title="Pronounce"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              {canManageLearning && (
                <button
                  onClick={handleGenerateDetails}
                  disabled={isGeneratingDetails}
                  className="p-1.5 text-amber-500 bg-amber-50 dark:bg-amber-500/10 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  title="Generate Meaning & Mnemonic with AI"
                >
                  {isGeneratingDetails ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            <button
              onClick={() => setIsPopupOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              Meaning
            </label>
            <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              value={vocab.meaning}
              onChange={(e) => onUpdate({ meaning: e.target.value })}
              readOnly={!canManageLearning}
              placeholder="English meaning..."
              rows={2}
              className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-700 dark:text-slate-200 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Mnemonic
            </label>
            <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              value={vocab.mnemonic}
              onChange={(e) => onUpdate({ mnemonic: e.target.value })}
              readOnly={!canManageLearning}
              placeholder="Trick to remember..."
              rows={2}
              className="w-full text-sm p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-700 dark:text-slate-200 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="checkbox"
              id={`mastered-popup-${vocab.id}`}
              checked={vocab.isMastered}
              onChange={(e) => onUpdate({ isMastered: e.target.checked })}
              className="w-4 h-4 text-green-500 rounded border-slate-300 focus:ring-green-500 cursor-pointer"
            />
            <label
              htmlFor={`mastered-popup-${vocab.id}`}
              className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            >
              Mark as Mastered
            </label>
          </div>
        </div>
      )}

      <div className="w-full h-px bg-slate-100 dark:bg-slate-800/80 my-0.5" />

      {/* Row 2: Synonyms */}
      <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50 px-2.5 py-1.5 rounded-md -mx-2">
        <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 w-9 md:w-10 flex-none pt-1 mb-0 -mr-2.5 md:-mr-3.5">
          SYN:
        </span>
        <TextareaAutosize
          value={synonyms}
          onChange={(e) => setSynonyms(e.target.value)}
          onBlur={() =>
            onUpdate({
              synonyms: synonyms
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          readOnly={!canManageLearning}
          placeholder="e.g. happy, joyful, elated..."
          className="flex-1 text-[13px] md:text-sm font-medium text-slate-700 dark:text-slate-300 bg-transparent outline-none placeholder:text-emerald-600/40 dark:placeholder:text-emerald-500/40 resize-none leading-relaxed"
        />
      </div>

      {/* Row 3: Antonyms */}
      <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800/50 px-2.5 py-1.5 rounded-md -mx-2 mt-1">
        <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-red-500 dark:text-red-400 w-9 md:w-10 flex-none pt-1 mb-0 -mr-2.5 md:-mr-3.5">
          ANT:
        </span>
        <TextareaAutosize
          value={antonyms}
          onChange={(e) => setAntonyms(e.target.value)}
          onBlur={() =>
            onUpdate({
              antonyms: antonyms
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          readOnly={!canManageLearning}
          placeholder="e.g. sad, depressed, sorrowful..."
          className="flex-1 text-[13px] md:text-sm font-medium text-slate-700 dark:text-slate-300 bg-transparent outline-none placeholder:text-red-500/30 dark:placeholder:text-red-400/30 resize-none leading-relaxed"
        />
      </div>

      {/* Row 4: Additional */}
      {(canManageLearning || vocab.additional) && (
        <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-2.5 py-1.5 rounded-md -mx-2 mt-1 relative">
          <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-9 md:w-10 flex-none pt-1 mb-0 -mr-2.5 md:-mr-3.5">
            ADD:
          </span>
          <div className="flex-1 relative pr-6">
            <TextareaAutosize
              value={vocab.additional || ""}
              onChange={(e) => onUpdate({ additional: e.target.value })}
              readOnly={!canManageLearning}
              maxRows={isAddExpanded ? undefined : 2}
              placeholder="(grouping): additional synonyms or notes..."
              className="w-full text-[13px] md:text-sm font-medium text-slate-700 dark:text-slate-300 bg-transparent outline-none placeholder:text-slate-400/50 dark:placeholder:text-slate-500/50 resize-none leading-relaxed overflow-hidden"
            />
            {((vocab.additional?.length || 0) > 30 || canManageLearning) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddExpanded(!isAddExpanded);
                }}
                className="absolute right-0 bottom-1 p-1 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-800/80 rounded-sm z-10"
              >
                {isAddExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Row 5: Example */}
      <div className="flex items-start gap-2 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-800 mt-0.5">
        <TextareaAutosize
          value={vocab.example}
          onChange={(e) => onUpdate({ example: e.target.value })}
          readOnly={!canManageLearning}
          placeholder="Write a sentence using the word..."
          className="flex-1 text-[13px] md:text-sm italic text-slate-600 dark:text-slate-400 bg-transparent outline-none resize-none placeholder:text-slate-300 dark:placeholder:text-slate-700 leading-relaxed min-h-[24px]"
        />
      </div>

      {/* Move to Custom Folder Dialog */}
      {isMyVocabsView && (
        <MoveVocabDialog
          isOpen={isMoveDialogOpen}
          onClose={() => setIsMoveDialogOpen(false)}
          vocabId={vocab.id}
          vocabWord={vocab.word}
        />
      )}
    </div>
  );
}
