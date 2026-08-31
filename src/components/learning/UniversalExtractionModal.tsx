import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Youtube,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  FileText,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Sliders,
  SlidersHorizontal,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Type,
  Trash2,
  Edit2,
  Plus,
  Search,
  RotateCcw,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Languages,
  BookMarked,
  Settings2,
  Download,
  Code,
  Eye,
  FileDown,
} from 'lucide-react';
import {
  extractVocabFromEditorialTranscript,
  extractRawTextFromDocument,
  ExtractedEditorialVocabulary,
} from '../../services/aiService';
import { useVocabularyStore, VocabEntry, TextEntry } from '../../store/vocabularyStore';
import {
  ExtractionSession,
  ExtractionSourceType,
  ExtractionSourceMetadata,
} from '../../types/extraction';
import { ExtractionCacheManager } from '../../utils/extractionCacheManager';
import { getActiveApiKey } from '../../utils/apiKeyManager';
import { truncatePdf } from '../../utils/pdfTruncation';
import { getLearningSettings } from '../../services/learningSettingsFirebaseService';
import {
  DEFAULT_VOCAB_EXTRACTION_SETTINGS,
  VocabExtractionSettings,
} from '../../types/learningSettings';
import {
  parseVocabMarkdown,
  formatVocabToMarkdown,
  formatVocabToCleanText,
  ParsedVocabWord,
} from '../../utils/vocabMarkdownParser';

interface UniversalExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCanvasId?: string | null;
  initialSourceType?: ExtractionSourceType;
  onSuccess?: (canvasId: string, extractedData: ExtractedEditorialVocabulary) => void;
}

interface StagingWord {
  id: string;
  word: string;
  pos: string;
  meaning: string;
  mnemonic?: string;
  synonyms: string[];
  antonyms: string[];
  additional?: string;
  additionalGroups?: Array<{ theme: string; terms: string }>;
  example?: string;
  editorialContext?: string;
}

interface StagingIdiom {
  id: string;
  phrase: string;
  meaning: string;
  example?: string;
}

function StagingWordCard({
  word,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  word: StagingWord;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: Partial<StagingWord>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draftWord, setDraftWord] = useState(word.word);
  const [draftPos, setDraftPos] = useState(word.pos || 'Noun');
  const [draftMeaning, setDraftMeaning] = useState(word.meaning || '');
  const [draftSynonyms, setDraftSynonyms] = useState(word.synonyms?.join(', ') || '');
  const [draftAntonyms, setDraftAntonyms] = useState(word.antonyms?.join(', ') || '');
  const [draftAdditional, setDraftAdditional] = useState(
    word.additional ||
      (word.additionalGroups
        ? word.additionalGroups.map((g) => `(${g.theme}): ${g.terms}`).join('\n')
        : '')
  );
  const [draftExample, setDraftExample] = useState(word.example || '');

  useEffect(() => {
    setDraftWord(word.word);
    setDraftPos(word.pos || 'Noun');
    setDraftMeaning(word.meaning || '');
    setDraftSynonyms(word.synonyms?.join(', ') || '');
    setDraftAntonyms(word.antonyms?.join(', ') || '');
    setDraftAdditional(
      word.additional ||
        (word.additionalGroups
          ? word.additionalGroups.map((g) => `(${g.theme}): ${g.terms}`).join('\n')
          : '')
    );
    setDraftExample(word.example || '');
  }, [word, isEditing]);

  const handleSave = () => {
    const synList = draftSynonyms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const antList = draftAntonyms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const additionalLines = draftAdditional.split('\n');
    const groups: Array<{ theme: string; terms: string }> = [];
    for (const line of additionalLines) {
      const match = line.match(/^\s*\(([^)]+)\)\s*:\s*(.+)$/);
      if (match) {
        groups.push({ theme: match[1].trim(), terms: match[2].trim() });
      } else if (line.trim()) {
        groups.push({ theme: 'Related', terms: line.trim() });
      }
    }

    onSave({
      word: draftWord.trim() || 'Untitled Word',
      pos: draftPos.trim() || 'Noun',
      meaning: draftMeaning.trim(),
      synonyms: synList,
      antonyms: antList,
      additional: draftAdditional.trim(),
      additionalGroups: groups,
      example: draftExample.trim(),
      editorialContext: draftAdditional.trim(),
    });
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-indigo-50/50 dark:bg-slate-900/90 border-2 border-indigo-500/80 rounded-2xl space-y-3.5 shadow-sm animate-in fade-in duration-150">
        {/* Header: Word Name & POS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-indigo-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={draftWord}
              onChange={(e) => setDraftWord(e.target.value)}
              placeholder="Word / Term..."
              className="px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 flex-1 max-w-xs"
              autoFocus
            />
            <select
              value={draftPos}
              onChange={(e) => setDraftPos(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Noun">Noun</option>
              <option value="Verb">Verb</option>
              <option value="Adjective">Adjective</option>
              <option value="Adverb">Adverb</option>
              <option value="Idiom">Idiom</option>
              <option value="Phrasal Verb">Phrasal Verb</option>
              <option value="Preposition">Preposition</option>
              <option value="Conjunction">Conjunction</option>
              <option value="Interjection">Interjection</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-center">
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              title="Delete Word"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Meaning */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Meaning:
          </label>
          <textarea
            rows={2}
            value={draftMeaning}
            onChange={(e) => setDraftMeaning(e.target.value)}
            placeholder="Definitions and contextual meaning..."
            className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
          />
        </div>

        {/* Synonyms & Antonyms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Synonyms (comma-separated):
            </label>
            <input
              type="text"
              value={draftSynonyms}
              onChange={(e) => setDraftSynonyms(e.target.value)}
              placeholder="e.g. Turbulent, Tumultuous, Volatile"
              className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Antonyms (comma-separated):
            </label>
            <input
              type="text"
              value={draftAntonyms}
              onChange={(e) => setDraftAntonyms(e.target.value)}
              placeholder="e.g. Tranquil, Calm, Placid, Serene"
              className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Additional Themes & Words */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Additional Themes & Related Words:
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Format: (Theme): Word1, Word2
            </span>
          </div>
          <textarea
            rows={3}
            value={draftAdditional}
            onChange={(e) => setDraftAdditional(e.target.value)}
            placeholder={`(Extreme Turmoil/Chaos): Turmoil, Turbulence, Cataclysmic\n(Uncontrolled Emotions): Uncontrolled excitement`}
            className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
          />
        </div>

        {/* Example Sentence */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Example Sentence:
          </label>
          <textarea
            rows={2}
            value={draftExample}
            onChange={(e) => setDraftExample(e.target.value)}
            placeholder="e.g. The country endured a very turbulent period..."
            className="w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={onStartEdit}
      className="group relative p-4 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 border border-slate-200/80 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-900/60 rounded-2xl space-y-1.5 transition-all duration-150"
    >
      {/* Top Bar with Word Title and Floating Edit / Delete Controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
          {word.word} ({word.pos || 'Noun'})
        </div>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onStartEdit}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
            title="Edit this word entry"
          >
            <Edit2 className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Delete this word"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Meaning */}
      {word.meaning && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Meaning: </span>
          <span>{word.meaning}</span>
        </div>
      )}

      {/* Synonyms */}
      {word.synonyms && word.synonyms.length > 0 && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Synonyms: </span>
          <span>{word.synonyms.join(', ')}</span>
        </div>
      )}

      {/* Antonyms */}
      {word.antonyms && word.antonyms.length > 0 && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Antonyms: </span>
          <span>{word.antonyms.join(', ')}</span>
        </div>
      )}

      {/* Additional Themes & Words */}
      {(word.additional || (word.additionalGroups && word.additionalGroups.length > 0)) && (
        <div className="text-slate-800 dark:text-slate-200">
          <div className="font-medium text-slate-900 dark:text-slate-100">Additional:</div>
          {word.additionalGroups && word.additionalGroups.length > 0 ? (
            <div className="space-y-0.5 mt-0.5">
              {word.additionalGroups.map((g, gIdx) => (
                <div key={gIdx} className="text-slate-800 dark:text-slate-200">
                  ({g.theme}): {g.terms}
                </div>
              ))}
            </div>
          ) : (
            <div className="whitespace-pre-wrap mt-0.5">{word.additional}</div>
          )}
        </div>
      )}

      {/* Example */}
      {word.example && (
        <div className="text-slate-800 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-slate-100">Example: </span>
          <span>{word.example}</span>
        </div>
      )}
    </div>
  );
}

function StagingIdiomCard({
  idiom,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  idiom: StagingIdiom;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (updates: Partial<StagingIdiom>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draftPhrase, setDraftPhrase] = useState(idiom.phrase);
  const [draftMeaning, setDraftMeaning] = useState(idiom.meaning);
  const [draftExample, setDraftExample] = useState(idiom.example || '');

  useEffect(() => {
    setDraftPhrase(idiom.phrase);
    setDraftMeaning(idiom.meaning);
    setDraftExample(idiom.example || '');
  }, [idiom, isEditing]);

  const handleSave = () => {
    onSave({
      phrase: draftPhrase.trim() || 'Untitled Idiom',
      meaning: draftMeaning.trim(),
      example: draftExample.trim(),
    });
  };

  if (isEditing) {
    return (
      <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-900/90 border-2 border-indigo-500/80 rounded-xl space-y-2.5 animate-in fade-in duration-150">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={draftPhrase}
            onChange={(e) => setDraftPhrase(e.target.value)}
            placeholder="Idiom / Phrase..."
            className="px-2.5 py-1 font-bold text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
              title="Delete Idiom"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={draftMeaning}
          onChange={(e) => setDraftMeaning(e.target.value)}
          placeholder="Meaning..."
          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={draftExample}
          onChange={(e) => setDraftExample(e.target.value)}
          placeholder="Example sentence..."
          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={onStartEdit}
      className="group p-3 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-slate-900/40 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
          {idiom.phrase}
        </div>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onStartEdit}
            className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
          >
            <Edit2 className="w-2.5 h-2.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 bg-white dark:bg-slate-800 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded text-[11px] cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      {idiom.meaning && (
        <div className="text-xs text-slate-700 dark:text-slate-300">
          <span className="font-medium">Meaning: </span>
          {idiom.meaning}
        </div>
      )}
      {idiom.example && (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium">Example: </span>
          {idiom.example}
        </div>
      )}
    </div>
  );
}

export function UniversalExtractionModal({
  isOpen,
  onClose,
  targetCanvasId,
  initialSourceType = 'youtube',
  onSuccess,
}: UniversalExtractionModalProps) {
  const { canvases, addCanvas, addVocab, addTextEntry } = useVocabularyStore();

  // Wizard Step: 1 = Source Ingestion, 2 = Raw Text Verification, 3 = Staging Review, 4 = Success/Commit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Source selection state
  const [sourceType, setSourceType] = useState<ExtractionSourceType>(initialSourceType);
  const [sourceMetadata, setSourceMetadata] = useState<ExtractionSourceMetadata>({});

  // Input states
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [startTimeStr, setStartTimeStr] = useState('00:00');
  const [endTimeStr, setEndTimeStr] = useState('30:00');

  // Document file states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageRange, setPageRange] = useState('All pages selected');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text Verification states (Step 2)
  const [rawText, setRawText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showInstructionField, setShowInstructionField] = useState(false);
  const [copied, setCopied] = useState(false);

  // Global Defaults & Configuration states (Step 2)
  const [globalDefaults, setGlobalDefaults] = useState<VocabExtractionSettings>(DEFAULT_VOCAB_EXTRACTION_SETTINGS);
  const [defaultsLoaded, setDefaultsLoaded] = useState<boolean>(false);

  // Staging Review states (Step 3)
  const [stagingTitle, setStagingTitle] = useState('');
  const [stagingTopic, setStagingTopic] = useState('');
  const [stagingMarkdown, setStagingMarkdown] = useState('');
  const [step3ViewMode, setStep3ViewMode] = useState<'rendered' | 'editor'>('rendered');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [stagingWords, setStagingWords] = useState<StagingWord[]>([]);
  const [stagingIdioms, setStagingIdioms] = useState<StagingIdiom[]>([]);
  const [stagingTab, setStagingTab] = useState<'words' | 'idioms'>('words');
  const [stagingSearch, setStagingSearch] = useState('');
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingIdiomId, setEditingIdiomId] = useState<string | null>(null);

  // Cache recovery state
  const [savedDraftAvailable, setSavedDraftAvailable] = useState<boolean>(false);
  const [savedDraftSummary, setSavedDraftSummary] = useState<string | null>(null);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCanvasId, setSuccessCanvasId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Check for saved draft & load global defaults on open
  useEffect(() => {
    if (isOpen) {
      const summary = ExtractionCacheManager.getSessionSummary();
      if (summary) {
        setSavedDraftAvailable(true);
        const minsAgo = Math.max(1, Math.round(summary.ageMs / 60000));
        setSavedDraftSummary(
          `Draft "${summary.title}" from ${summary.sourceType.toUpperCase()} (Step ${summary.step}, saved ~${minsAgo}m ago)`
        );
      } else {
        setSavedDraftAvailable(false);
        setSavedDraftSummary(null);
      }

      // Fetch global vocabExtraction defaults from Firestore
      getLearningSettings()
        .then((res) => {
          if (res && res.vocabExtraction) {
            const defs = res.vocabExtraction;
            setGlobalDefaults(defs);
            setCustomInstructions((prev) => {
              if (!prev && defs.defaultCustomInstructions) {
                return defs.defaultCustomInstructions;
              }
              return prev;
            });
            setDefaultsLoaded(true);
          }
        })
        .catch((err) => {
          console.error('Failed to load global learning defaults from Firestore:', err);
        });
    }
  }, [isOpen]);

  // Sync initialSourceType prop
  useEffect(() => {
    if (initialSourceType && currentStep === 1) {
      setSourceType(initialSourceType);
    }
  }, [initialSourceType]);

  // Clean up image preview object URL
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Helper to extract YouTube video ID from URL
  const videoId = useMemo(() => {
    if (!youtubeUrl.trim()) return null;
    const trimmed = youtubeUrl.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
    );
    return match ? match[1] : null;
  }, [youtubeUrl]);

  // Helper to parse time string
  const parseTimeToSeconds = (str: string): number => {
    if (!str) return 0;
    const parts = str.trim().split(':').map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseInt(str, 10) || 0;
  };

  const formatSeconds = (totalSec: number): string => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = Math.floor(totalSec % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Persist session state helper
  const persistCurrentSession = (step: 1 | 2 | 3 | 4, customAiOutput?: ExtractedEditorialVocabulary | null) => {
    const aiOutput: ExtractedEditorialVocabulary | null = customAiOutput !== undefined
      ? customAiOutput
      : stagingWords.length > 0
      ? {
          title: stagingTitle,
          topic: stagingTopic,
          words: stagingWords.map((w) => ({
            word: w.word,
            pos: w.pos,
            meaning: w.meaning,
            mnemonic: w.mnemonic,
            synonyms: w.synonyms,
            antonyms: w.antonyms,
            example: w.example,
            editorialContext: w.editorialContext,
          })),
          idiomsAndPhrases: stagingIdioms.map((i) => ({
            phrase: i.phrase,
            meaning: i.meaning,
            example: i.example,
          })),
        }
      : null;

    const session: ExtractionSession = {
      sourceType,
      sourceMetadata,
      rawText,
      customInstructions,
      aiOutput,
      currentStep: step,
      lastUpdated: Date.now(),
    };

    ExtractionCacheManager.saveSessionImmediate(session);
  };

  // Restore saved draft
  const handleRestoreDraft = () => {
    const session = ExtractionCacheManager.loadSession();
    if (!session) return;

    setSourceType(session.sourceType);
    setSourceMetadata(session.sourceMetadata || {});
    setRawText(session.rawText || '');
    setCustomInstructions(session.customInstructions || '');

    if (session.aiOutput) {
      const rawMd = session.aiOutput.rawMarkdown || formatVocabToMarkdown({ words: session.aiOutput.words || [] });
      setStagingMarkdown(rawMd);

      const parsed = parseVocabMarkdown(rawMd);
      setStagingTitle(parsed.headerTitle || session.aiOutput.title || 'Core Vocabularies & Additional Words');
      setStagingTopic(session.aiOutput.topic || 'English & Editorial Analysis');

      if (parsed.words.length > 0) {
        setStagingWords(parsed.words);
      } else if (session.aiOutput.words) {
        setStagingWords(
          session.aiOutput.words.map((w, idx) => ({
            id: `draft-w-${idx}-${Date.now()}`,
            word: w.word || '',
            pos: w.pos || 'Noun',
            meaning: w.meaning || '',
            mnemonic: w.mnemonic || '',
            synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
            antonyms: Array.isArray(w.antonyms) ? w.antonyms : [],
            additional: w.additional || w.editorialContext || '',
            example: w.example || '',
            editorialContext: w.editorialContext || '',
          }))
        );
      }
    }

    setCurrentStep(session.currentStep || 2);
    setSavedDraftAvailable(false);
    setErrorMessage(null);
  };

  // Discard saved draft
  const handleDiscardDraft = () => {
    ExtractionCacheManager.clearSession();
    setSavedDraftAvailable(false);
    setSavedDraftSummary(null);
  };

  // Reset all state
  const handleReset = () => {
    setCurrentStep(1);
    setSourceType(initialSourceType);
    setSourceMetadata({});
    setYoutubeUrl('');
    setUseCustomRange(false);
    setStartTimeStr('00:00');
    setEndTimeStr('30:00');
    setSelectedFile(null);
    setPageRange('All pages selected');
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setRawText('');
    setCustomInstructions(globalDefaults.defaultCustomInstructions || '');
    setStagingTitle('');
    setStagingTopic('');
    setStagingMarkdown('');
    setStep3ViewMode('rendered');
    setCopiedMarkdown(false);
    setStagingWords([]);
    setStagingIdioms([]);
    setStagingSearch('');
    setIsLoading(false);
    setErrorMessage(null);
    setSuccessCanvasId(null);
    setToastMessage(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Copy raw text to clipboard
  const handleCopyRawText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ==========================================
  // STEP 1: Source Ingestion Actions
  // ==========================================

  // 1A. Fetch YouTube Transcript
  const handleFetchYouTubeTranscript = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!videoId) {
      setErrorMessage('Please provide a valid YouTube video URL or ID.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setLoadingMessage('Fetching YouTube transcript and metadata...');

    try {
      const payload: any = { 
        url: youtubeUrl.trim(),
        videoUrl: youtubeUrl.trim() 
      };
      if (useCustomRange) {
        payload.startTimeSec = parseTimeToSeconds(startTimeStr);
        payload.endTimeSec = parseTimeToSeconds(endTimeStr);
      }

      const response = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { error: responseText || 'Invalid response from server' };
      }

      if (!response.ok || !data.fullText) {
        throw new Error(data.error || 'No transcript could be retrieved for this video.');
      }

      const meta: ExtractionSourceMetadata = {
        title: data.videoTitle || 'YouTube Class',
        channel: data.channelTitle,
        url: youtubeUrl.trim(),
        durationSec: data.extractedDurationSec || data.totalDurationSec,
        wordCount: data.fullText.trim().split(/\s+/).length,
        extractedAt: Date.now(),
      };

      setSourceMetadata(meta);
      setRawText(data.fullText);
      setCurrentStep(2);

      // Save to cache
      ExtractionCacheManager.saveSessionImmediate({
        sourceType: 'youtube',
        sourceMetadata: meta,
        rawText: data.fullText,
        customInstructions,
        aiOutput: null,
        currentStep: 2,
        lastUpdated: Date.now(),
      });
    } catch (err: any) {
      console.error('YouTube transcript fetch error:', err);
      setErrorMessage(err.message || 'Failed to fetch transcript. You can paste the text manually below.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // 1B. Process PDF or Image via OCR / Extraction
  const handleProcessDocumentFile = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select or upload a document file.');
      return;
    }

    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setErrorMessage('Please configure your Gemini API Key in the AI Settings (top right of Learning Hub).');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setLoadingMessage(
      sourceType === 'pdf'
        ? 'Extracting and transcribing text from PDF...'
        : 'Running OCR on image / screenshot...'
    );

    try {
      let base64Data = '';
      const mimeType = selectedFile.type || (sourceType === 'pdf' ? 'application/pdf' : 'image/png');

      if (sourceType === 'pdf' && pageRange && pageRange !== 'All pages selected') {
        const truncatedBlob = await truncatePdf(selectedFile, pageRange);
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(truncatedBlob);
        });
      } else {
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      const extractedText = await extractRawTextFromDocument(base64Data, mimeType);

      if (!extractedText.trim()) {
        throw new Error('No legible text could be extracted from this file. Try another file or paste text directly.');
      }

      const meta: ExtractionSourceMetadata = {
        fileName: selectedFile.name,
        title: selectedFile.name.replace(/\.[^/.]+$/, ''),
        wordCount: extractedText.trim().split(/\s+/).length,
        extractedAt: Date.now(),
      };

      setSourceMetadata(meta);
      setRawText(extractedText);
      setCurrentStep(2);

      // Save to cache
      ExtractionCacheManager.saveSessionImmediate({
        sourceType,
        sourceMetadata: meta,
        rawText: extractedText,
        customInstructions,
        aiOutput: null,
        currentStep: 2,
        lastUpdated: Date.now(),
      });
    } catch (err: any) {
      console.error('Document OCR extraction error:', err);
      setErrorMessage(err.message || 'Failed to extract text from file.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // 1C. Process Raw Text Directly
  const handleProceedWithRawText = () => {
    if (!rawText.trim()) {
      setErrorMessage('Please enter or paste vocabulary content to proceed.');
      return;
    }

    setErrorMessage(null);
    const meta: ExtractionSourceMetadata = {
      title: 'Manual Text Ingestion',
      wordCount: rawText.trim().split(/\s+/).length,
      extractedAt: Date.now(),
    };
    setSourceMetadata(meta);
    setCurrentStep(2);

    ExtractionCacheManager.saveSessionImmediate({
      sourceType: 'text',
      sourceMetadata: meta,
      rawText,
      customInstructions,
      aiOutput: null,
      currentStep: 2,
      lastUpdated: Date.now(),
    });
  };

  // File selection handler for PDF / Image
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage(null);

    if (sourceType === 'image' || file.type.startsWith('image/')) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  // ==========================================
  // STEP 2: Generate AI Vocabulary from Text
  // ==========================================
  const handleGenerateVocabulary = async () => {
    if (!rawText.trim()) {
      setErrorMessage('Text content is empty. Please ensure text is present before generating vocabulary.');
      return;
    }

    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setErrorMessage('Please configure your Gemini API Key in the AI Settings (top right of Learning Hub).');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setLoadingMessage('Gemini is analyzing the text and structuring vocabulary, mnemonics, and idioms...');

    try {
      const videoContext = {
        title: sourceMetadata.title,
        channel: sourceMetadata.channel,
        duration: sourceMetadata.durationSec,
      };

      const result = await extractVocabFromEditorialTranscript(
        rawText,
        videoContext,
        customInstructions.trim() || undefined
      );

      if (!result || !result.words || result.words.length === 0) {
        throw new Error('Gemini could not identify any vocabulary words in this text. Try adjusting the text or instructions.');
      }

      const rawMd = result.rawMarkdown || formatVocabToMarkdown({ words: result.words });
      setStagingMarkdown(rawMd);

      const parsed = parseVocabMarkdown(rawMd);
      const docTitle = parsed.headerTitle || result.title || sourceMetadata.title || 'Core Vocabularies & Additional Words';
      setStagingTitle(docTitle);
      setStagingTopic(result.topic || 'English & Editorial Analysis');

      const words: StagingWord[] = (parsed.words.length > 0 ? parsed.words : result.words).map((w: any, idx: number) => ({
        id: `word-${idx}-${Date.now()}`,
        word: w.word || '',
        pos: w.pos || 'Noun',
        meaning: w.meaning || '',
        mnemonic: w.mnemonic || '',
        synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
        antonyms: Array.isArray(w.antonyms) ? w.antonyms : [],
        additional: w.additional || w.editorialContext || '',
        additionalGroups: w.additionalGroups || [],
        example: w.example || '',
        editorialContext: w.editorialContext || w.additional || '',
      }));

      const idioms: StagingIdiom[] = (result.idiomsAndPhrases || []).map((i, idx) => ({
        id: `idiom-${idx}-${Date.now()}`,
        phrase: i.phrase || '',
        meaning: i.meaning || '',
        example: i.example || '',
      }));

      setStagingWords(words);
      setStagingIdioms(idioms);
      setCurrentStep(3);

      // Save to cache
      persistCurrentSession(3, {
        ...result,
        rawMarkdown: rawMd,
      });
    } catch (err: any) {
      console.error('AI vocabulary extraction error:', err);
      setErrorMessage(err.message || 'Gemini failed to extract vocabulary. Your text is saved so you can retry.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // ==========================================
  // STEP 3: Staging Area Actions & Markdown Sync
  // ==========================================
  const handleMarkdownChange = (newMd: string) => {
    setStagingMarkdown(newMd);
    const parsed = parseVocabMarkdown(newMd);
    if (parsed.headerTitle) {
      setStagingTitle(parsed.headerTitle);
    }
    const updatedWords: StagingWord[] = parsed.words.map((w, idx) => ({
      id: `word-${idx}-${Date.now()}`,
      word: w.word || '',
      pos: w.pos || 'Noun',
      meaning: w.meaning || '',
      mnemonic: w.mnemonic || '',
      synonyms: w.synonyms || [],
      antonyms: w.antonyms || [],
      additional: w.additional || '',
      additionalGroups: w.additionalGroups || [],
      example: w.example || '',
      editorialContext: w.additional || '',
    }));
    setStagingWords(updatedWords);

    ExtractionCacheManager.saveSession({
      sourceType,
      sourceMetadata,
      rawText,
      customInstructions,
      aiOutput: {
        title: parsed.headerTitle || stagingTitle,
        topic: stagingTopic,
        rawMarkdown: newMd,
        words: updatedWords,
        idiomsAndPhrases: stagingIdioms,
      },
      currentStep: 3,
      lastUpdated: Date.now(),
    });
  };

  const handleCopyMarkdown = async () => {
    try {
      const cleanTextToCopy = formatVocabToCleanText({
        title: stagingTitle,
        words: stagingWords,
      });
      await navigator.clipboard.writeText(cleanTextToCopy || stagingMarkdown);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleDownloadMarkdown = () => {
    const cleanTextToDownload = formatVocabToCleanText({
      title: stagingTitle,
      words: stagingWords,
    });
    const blob = new Blob([cleanTextToDownload || stagingMarkdown], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (stagingTitle || 'Core_Vocabularies').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateWord = (id: string, updates: Partial<StagingWord>) => {
    const updated = stagingWords.map((w) => (w.id === id ? { ...w, ...updates } : w));
    setStagingWords(updated);
    setEditingWordId(null);
    const newMd = formatVocabToMarkdown({
      title: stagingTitle,
      words: updated,
    });
    setStagingMarkdown(newMd);
    ExtractionCacheManager.saveSession({
      sourceType,
      sourceMetadata,
      rawText,
      customInstructions,
      aiOutput: {
        title: stagingTitle,
        topic: stagingTopic,
        rawMarkdown: newMd,
        words: updated,
        idiomsAndPhrases: stagingIdioms,
      },
      currentStep: 3,
      lastUpdated: Date.now(),
    });
  };

  const handleDeleteWord = (id: string) => {
    const updated = stagingWords.filter((w) => w.id !== id);
    setStagingWords(updated);
    if (editingWordId === id) setEditingWordId(null);
    const newMd = formatVocabToMarkdown({
      title: stagingTitle,
      words: updated,
    });
    setStagingMarkdown(newMd);
    ExtractionCacheManager.saveSession({
      sourceType,
      sourceMetadata,
      rawText,
      customInstructions,
      aiOutput: {
        title: stagingTitle,
        topic: stagingTopic,
        rawMarkdown: newMd,
        words: updated,
        idiomsAndPhrases: stagingIdioms,
      },
      currentStep: 3,
      lastUpdated: Date.now(),
    });
  };

  const handleUpdateIdiom = (id: string, updates: Partial<StagingIdiom>) => {
    const updated = stagingIdioms.map((i) => (i.id === id ? { ...i, ...updates } : i));
    setStagingIdioms(updated);
    setEditingIdiomId(null);
    ExtractionCacheManager.saveSession({
      sourceType,
      sourceMetadata,
      rawText,
      customInstructions,
      aiOutput: {
        title: stagingTitle,
        topic: stagingTopic,
        rawMarkdown: stagingMarkdown,
        words: stagingWords,
        idiomsAndPhrases: updated,
      },
      currentStep: 3,
      lastUpdated: Date.now(),
    });
  };

  const handleDeleteIdiom = (id: string) => {
    const updated = stagingIdioms.filter((i) => i.id !== id);
    setStagingIdioms(updated);
    if (editingIdiomId === id) setEditingIdiomId(null);
    ExtractionCacheManager.saveSession({
      sourceType,
      sourceMetadata,
      rawText,
      customInstructions,
      aiOutput: {
        title: stagingTitle,
        topic: stagingTopic,
        rawMarkdown: stagingMarkdown,
        words: stagingWords,
        idiomsAndPhrases: updated,
      },
      currentStep: 3,
      lastUpdated: Date.now(),
    });
  };

  const handleAddNewWord = () => {
    const newWord: StagingWord = {
      id: `custom-word-${Date.now()}`,
      word: '',
      pos: 'Noun',
      meaning: '',
      synonyms: [],
      antonyms: [],
      additional: '',
      additionalGroups: [],
      example: '',
    };
    const updated = [newWord, ...stagingWords];
    setStagingWords(updated);
    setEditingWordId(newWord.id);
    const newMd = formatVocabToMarkdown({
      title: stagingTitle,
      words: updated,
    });
    setStagingMarkdown(newMd);
  };

  const handleAddNewIdiom = () => {
    const newIdiom: StagingIdiom = {
      id: `custom-idiom-${Date.now()}`,
      phrase: '',
      meaning: '',
      example: '',
    };
    const updated = [newIdiom, ...stagingIdioms];
    setStagingIdioms(updated);
    setEditingIdiomId(newIdiom.id);
  };

  // Filtered lists for search
  const filteredWords = useMemo(() => {
    if (!stagingSearch.trim()) return stagingWords;
    const q = stagingSearch.toLowerCase();
    return stagingWords.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.additional && w.additional.toLowerCase().includes(q)) ||
        w.synonyms.some((s) => s.toLowerCase().includes(q))
    );
  }, [stagingWords, stagingSearch]);

  const filteredIdioms = useMemo(() => {
    if (!stagingSearch.trim()) return stagingIdioms;
    const q = stagingSearch.toLowerCase();
    return stagingIdioms.filter(
      (i) => i.phrase.toLowerCase().includes(q) || i.meaning.toLowerCase().includes(q)
    );
  }, [stagingIdioms, stagingSearch]);

  // ==========================================
  // STEP 4: Commit & Finalization
  // ==========================================
  const handleApproveAndCommit = () => {
    if (stagingWords.length === 0 && stagingIdioms.length === 0) {
      setErrorMessage('No vocabulary items in staging to add.');
      return;
    }

    try {
      const formattedVocabs: VocabEntry[] = stagingWords.map((w) => ({
        id: Math.random().toString(36).substring(2, 9),
        word: w.word.trim() || '',
        meaning: w.meaning.trim() || '',
        mnemonic: w.mnemonic?.trim() || '',
        synonyms: w.synonyms || [],
        antonyms: w.antonyms || [],
        example: w.example?.trim() || '',
        pos: w.pos || '',
        additional: (w.additional || w.editorialContext || '').trim(),
        isMastered: false,
      }));

      const formattedIdioms: TextEntry[] = stagingIdioms.map((i) => ({
        id: Math.random().toString(36).substring(2, 9),
        text: i.phrase.trim() || '',
        meaning: i.meaning.trim() || '',
        example: i.example?.trim() || '',
      }));

      let destCanvasId = targetCanvasId;

      if (!destCanvasId) {
        // Create new canvas with formatted vocabularies & idioms directly
        const canvasTitle =
          stagingTitle ||
          sourceMetadata.title ||
          `Editorial Vocabulary - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        destCanvasId = addCanvas({
          title: canvasTitle,
          date: new Date().toISOString(),
          vocabularies: formattedVocabs,
          idioms: formattedIdioms,
          phrasalVerbs: [],
          oneWordSubs: [],
        });
      } else {
        // Add words to existing canvas
        formattedVocabs.forEach((w) => {
          addVocab(destCanvasId!, {
            word: w.word,
            meaning: w.meaning,
            mnemonic: w.mnemonic,
            synonyms: w.synonyms,
            antonyms: w.antonyms,
            example: w.example,
            pos: w.pos,
            additional: w.additional,
          });
        });

        // Add idioms to existing canvas if any
        formattedIdioms.forEach((i) => {
          addTextEntry(destCanvasId!, 'idioms', {
            text: i.text,
            meaning: i.meaning,
            example: i.example,
          });
        });
      }

      // Clear local storage cache
      ExtractionCacheManager.clearSession();

      setSuccessCanvasId(destCanvasId);
      setCurrentStep(4);

      const structuredResult: ExtractedEditorialVocabulary = {
        title: stagingTitle,
        topic: stagingTopic,
        rawMarkdown: stagingMarkdown,
        words: stagingWords.map((w) => ({
          word: w.word,
          pos: w.pos,
          meaning: w.meaning,
          mnemonic: w.mnemonic,
          synonyms: w.synonyms,
          antonyms: w.antonyms,
          additional: w.additional || w.editorialContext,
          example: w.example,
          editorialContext: w.editorialContext || w.additional,
        })),
        idiomsAndPhrases: stagingIdioms.map((i) => ({
          phrase: i.phrase,
          meaning: i.meaning,
          example: i.example,
        })),
      };

      if (onSuccess) {
        onSuccess(destCanvasId, structuredResult);
      }

      setToastMessage(
        `Successfully added ${stagingWords.length} words and ${stagingIdioms.length} idioms to Canvas!`
      );
    } catch (err: any) {
      console.error('Failed to commit staging vocabulary to canvas:', err);
      setErrorMessage(err.message || 'Failed to save to Editorial Canvas.');
    }
  };

  if (!isOpen) return null;

  const rawWordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="universal-vocab-extractor-modal"
        className="relative w-full max-w-4xl bg-white dark:bg-[#181920] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <span>Editorial Vocabulary Extractor</span>
                <span className="text-[11px] font-normal px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                  4-Step Pipeline
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extract, verify, curate, and format exam vocabulary with Gemini AI
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Step Progress Indicator Stepper */}
        <div className="px-6 py-2.5 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs">
          {[
            { num: 1, label: 'Source Ingestion', icon: Upload },
            { num: 2, label: 'Verify Raw Text', icon: FileText },
            { num: 3, label: 'Review & Staging', icon: Edit2 },
            { num: 4, label: 'Commit to Canvas', icon: CheckCheck },
          ].map((s, idx) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            const Icon = s.icon;
            return (
              <React.Fragment key={s.num}>
                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    isCurrent
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded ${
                      currentStep > idx + 1
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Saved Draft Recovery Banner */}
        {savedDraftAvailable && currentStep === 1 && (
          <div className="mx-6 mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{savedDraftSummary || 'Previous extraction draft available.'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
              >
                Resume Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-2 py-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: Active Step View */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {/* ======================================================== */}
          {/* STEP 1: SOURCE INGESTION                                 */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Source Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'youtube' as const, label: 'YouTube Video', icon: Youtube, color: 'text-red-500' },
                  { type: 'pdf' as const, label: 'PDF Document', icon: FileText, color: 'text-rose-500' },
                  { type: 'image' as const, label: 'Image / OCR', icon: ImageIcon, color: 'text-emerald-500' },
                  { type: 'text' as const, label: 'Raw Text', icon: Type, color: 'text-blue-500' },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = sourceType === tab.type;
                  return (
                    <button
                      key={tab.type}
                      type="button"
                      onClick={() => {
                        setSourceType(tab.type);
                        setErrorMessage(null);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm font-semibold'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${tab.color}`} />
                      <span className="text-xs">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Source 1: YouTube */}
              {sourceType === 'youtube' && (
                <form onSubmit={handleFetchYouTubeTranscript} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      YouTube Class / Editorial Video URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        autoFocus
                      />
                      <Youtube className="w-4 h-4 text-red-500 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Time Range Filter Toggle */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCustomRange}
                          onChange={(e) => setUseCustomRange(e.target.checked)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span>Extract specific class time range (e.g. first 30 mins)</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Default: 00:00 - 30:00</span>
                    </div>

                    {useCustomRange && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Start Time (MM:SS)</label>
                          <input
                            type="text"
                            value={startTimeStr}
                            onChange={(e) => setStartTimeStr(e.target.value)}
                            placeholder="00:00"
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">End Time (MM:SS)</label>
                          <input
                            type="text"
                            value={endTimeStr}
                            onChange={(e) => setEndTimeStr(e.target.value)}
                            placeholder="30:00"
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !youtubeUrl.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingMessage || 'Fetching Transcript...'}</span>
                      </>
                    ) : (
                      <>
                        <span>Fetch Transcript & Proceed to Step 2</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSourceType('text');
                        setSourceMetadata({
                          title: youtubeUrl ? `YouTube: ${youtubeUrl}` : 'Pasted Lecture Transcript',
                          url: youtubeUrl || undefined,
                        });
                        setCurrentStep(2);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium hover:underline transition-all"
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>I already have the transcript → Skip to Step 2</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Source 2: PDF Document */}
              {sourceType === 'pdf' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/30"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <FileText className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {selectedFile ? selectedFile.name : 'Click to select or drag a PDF file here'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {selectedFile
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB PDF selected`
                        : 'Supports editorial PDFs, class notes, and magazine cutouts'}
                    </p>
                  </div>

                  {selectedFile && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Page Range (Optional)
                      </label>
                      <input
                        type="text"
                        value={pageRange === 'All pages selected' ? '' : pageRange}
                        onChange={(e) => setPageRange(e.target.value || 'All pages selected')}
                        placeholder="e.g. 1-3, 5 (or leave empty for all)"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleProcessDocumentFile}
                    disabled={isLoading || !selectedFile}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingMessage || 'Transcribing PDF...'}</span>
                      </>
                    ) : (
                      <>
                        <span>Transcribe PDF & Proceed to Step 2</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Source 3: Image / OCR */}
              {sourceType === 'image' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/30"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    {imagePreviewUrl ? (
                      <div className="max-h-40 mx-auto overflow-hidden rounded-lg mb-2 inline-block">
                        <img
                          src={imagePreviewUrl}
                          alt="Upload preview"
                          className="max-h-40 object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <ImageIcon className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    )}
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {selectedFile ? selectedFile.name : 'Click to select or drag an Image/Screenshot'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports PNG, JPEG, WEBP screenshots of vocab tables or editorial columns
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleProcessDocumentFile}
                    disabled={isLoading || !selectedFile}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingMessage || 'Scanning Image OCR...'}</span>
                      </>
                    ) : (
                      <>
                        <span>OCR Image & Proceed to Step 2</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Source 4: Raw Text */}
              {sourceType === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Paste Vocabulary Notes / Editorial Article Text
                    </label>
                    <textarea
                      rows={8}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Paste your raw editorial text, vocabulary list, or transcript here..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleProceedWithRawText}
                    disabled={!rawText.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <span>Verify Content in Step 2</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: RAW TEXT VERIFICATION & AI PROMPT INJECTION      */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Context Summary Header */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {sourceMetadata.title || 'Extracted Source'}
                  </span>
                  {sourceMetadata.channel && (
                    <span className="text-slate-400 truncate">• {sourceMetadata.channel}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-mono text-[11px]">
                    {rawWordCount} words
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRawText}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Raw Text Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Extracted Raw Text (Editable)
                </label>
                <textarea
                  rows={9}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    ExtractionCacheManager.saveSession({
                      sourceType,
                      sourceMetadata,
                      rawText: e.target.value,
                      customInstructions,
                      aiOutput: null,
                      currentStep: 2,
                      lastUpdated: Date.now(),
                    });
                  }}
                  placeholder="Raw text will appear here..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar"
                />
              </div>

              {/* Custom AI Instructions Box (Collapsible, Collapsed by Default) */}
              <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 dark:from-indigo-950/30 dark:via-slate-900/60 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl p-3.5 shadow-sm transition-all">
                {/* Header (Clickable Accordion Trigger) */}
                <div
                  onClick={() => setShowInstructionField(!showInstructionField)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl shadow-xs shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                          Custom AI Instructions & Master Prompt
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                          {defaultsLoaded ? 'Platform Defaults Active' : 'Loading...'}
                        </span>
                        {!showInstructionField && customInstructions && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({customInstructions.length} chars)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {showInstructionField
                          ? 'These instructions will directly guide Gemini AI during vocabulary extraction.'
                          : 'Click to expand and view or customize master instructions.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] self-end sm:self-center">
                    {showInstructionField && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomInstructions(globalDefaults.defaultCustomInstructions || '');
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Re-sync platform defaults
                        </button>
                        {customInstructions && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomInstructions('');
                            }}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg font-medium transition-colors cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      aria-label="Toggle instructions"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                    >
                      {showInstructionField ? (
                        <ChevronUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Body */}
                {showInstructionField && (
                  <div className="pt-3 space-y-2 border-t border-indigo-100 dark:border-indigo-900/40 mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="relative">
                      <textarea
                        rows={6}
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Enter your custom system prompt or extraction instructions here..."
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono leading-relaxed custom-scrollbar"
                      />
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500 px-1">
                        <span>Active Prompt Length: {customInstructions.length} characters</span>
                        {customInstructions.trim() && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Custom instructions will override generic extraction defaults
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 Bottom Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Source</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateVocabulary}
                  disabled={isLoading || !rawText.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{loadingMessage || 'Generating AI Vocabulary...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate AI Vocabulary & Review in Step 3</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: SINGLE PAGE DOCUMENT VIEW & MARKDOWN EDITOR       */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Header Title, Count & Action Controls */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <input
                      type="text"
                      value={stagingTitle}
                      onChange={(e) => {
                        setStagingTitle(e.target.value);
                        const newMd = formatVocabToMarkdown({
                          title: e.target.value,
                          words: stagingWords,
                        });
                        setStagingMarkdown(newMd);
                      }}
                      placeholder="Core Vocabularies & Additional Words"
                      className="font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 outline-none text-sm sm:text-base px-1 py-0.5 w-full max-w-md"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {stagingWords.length} Core Vocabularies
                    </span>
                    <span>• Single Document View</span>
                  </div>
                </div>

                {/* View Mode & Export Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Toggle Rendered vs Markdown */}
                  <div className="flex items-center p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setStep3ViewMode('rendered')}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        step3ViewMode === 'rendered'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                      title="Stylized Document View"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Document</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep3ViewMode('editor')}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        step3ViewMode === 'editor'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                      title="Edit Raw Markdown"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Markdown</span>
                    </button>
                  </div>

                  {/* Copy Markdown Button */}
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                      copiedMarkdown
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                    title="Copy full vocabulary list in Markdown"
                  >
                    {copiedMarkdown ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Download Markdown Button */}
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="p-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                    title="Download as .md file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter Search Bar (when in Rendered View) */}
              {step3ViewMode === 'rendered' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={stagingSearch}
                      onChange={(e) => setStagingSearch(e.target.value)}
                      placeholder="Filter words, meanings, or additional themes..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddNewWord}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Word</span>
                  </button>
                </div>
              )}

              {/* Document Container */}
              {step3ViewMode === 'rendered' ? (
                <div className="p-4 sm:p-6 bg-white dark:bg-[#13141b] border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[54vh] overflow-y-auto custom-scrollbar select-text space-y-6">
                  {/* Clean Main Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                        {stagingTitle || 'Core Vocabularies & Additional Words'}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        💡 Click <span className="font-semibold text-indigo-600 dark:text-indigo-400">Edit</span> or double-click any card to modify definitions, themes, and examples.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={handleAddNewWord}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Word</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewIdiom}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Idiom</span>
                      </button>
                    </div>
                  </div>

                  {/* Vocabulary Word Cards */}
                  {filteredWords.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      No vocabulary items match your filter.
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
                      {filteredWords.map((word) => (
                        <StagingWordCard
                          key={word.id}
                          word={word}
                          isEditing={editingWordId === word.id}
                          onStartEdit={() => setEditingWordId(word.id)}
                          onSave={(updates) => handleUpdateWord(word.id, updates)}
                          onCancel={() => setEditingWordId(null)}
                          onDelete={() => handleDeleteWord(word.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Idioms & Phrases Section (if any present) */}
                  {stagingIdioms.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                          Idioms & Phrases ({stagingIdioms.length})
                        </div>
                        <button
                          type="button"
                          onClick={handleAddNewIdiom}
                          className="px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Idiom</span>
                        </button>
                      </div>
                      <div className="space-y-2.5">
                        {filteredIdioms.map((idiom) => (
                          <StagingIdiomCard
                            key={idiom.id}
                            idiom={idiom}
                            isEditing={editingIdiomId === idiom.id}
                            onStartEdit={() => setEditingIdiomId(idiom.id)}
                            onSave={(updates) => handleUpdateIdiom(idiom.id, updates)}
                            onCancel={() => setEditingIdiomId(null)}
                            onDelete={() => handleDeleteIdiom(idiom.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Raw Markdown Editor */
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={14}
                      value={stagingMarkdown}
                      onChange={(e) => handleMarkdownChange(e.target.value)}
                      placeholder="#### Core Vocabularies & Additional Words&#10;* **Debilitating (Adjective)**&#10;    * **Meaning:** ...&#10;    * **Synonyms:** ...&#10;    * **Antonyms:** ...&#10;    * **Additional:**&#10;        (weak): Feeble, Frail...&#10;    * **Example:** ..."
                      className="w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed rounded-2xl border border-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 custom-scrollbar resize-y max-h-[52vh]"
                      spellCheck={false}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    💡 Edits made in this Markdown editor synchronize directly with the parsed vocabulary entries and canvas commit.
                  </p>
                </div>
              )}

              {/* Step 3 Bottom Action Controls */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Text</span>
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndCommit}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Approve & Commit to Canvas ({stagingWords.length} Core Words)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: SUCCESS / COMMITTED CONFIRMATION                 */}
          {/* ======================================================== */}
          {currentStep === 4 && (
            <div className="py-8 px-4 text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Vocabulary Successfully Committed!
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {toastMessage ||
                    `Added ${stagingWords.length} curated words and ${stagingIdioms.length} idioms to your Editorial Canvas.`}
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs sm:text-sm transition-colors shadow-sm"
                >
                  View Canvas
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs sm:text-sm transition-colors"
                >
                  Extract Another Source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
