import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Check,
  Sparkles,
  FileText,
  Upload,
  Edit2,
  RotateCcw,
  CheckCheck,
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
} from '../../utils/vocabMarkdownParser';
import { useGeminiResolution } from '../../hooks/useGeminiResolution';
import { StagingWord } from './extraction/StagingWordCard';
import { StagingIdiom } from './extraction/StagingIdiomCard';
import { ExtractionStep1Source } from './extraction/ExtractionStep1Source';
import { ExtractionStep2Verify } from './extraction/ExtractionStep2Verify';
import { ExtractionStep3Staging } from './extraction/ExtractionStep3Staging';

interface UniversalExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCanvasId?: string | null;
  initialSourceType?: ExtractionSourceType;
  onSuccess?: (canvasId: string, extractedData: ExtractedEditorialVocabulary) => void;
}

export function UniversalExtractionModal({
  isOpen,
  onClose,
  targetCanvasId,
  initialSourceType = 'youtube',
  onSuccess,
}: UniversalExtractionModalProps) {
  const { canvases, addCanvas, addVocab, addTextEntry } = useVocabularyStore();
  const { isFeatureAllowed, isModelLocked, activeModel } = useGeminiResolution('vocab_extractor');

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

    if (!isFeatureAllowed) {
      setErrorMessage('An API Key is required for Editorial Vocabulary Extractor. Please add your Gemini key in Settings or request access from your Administrator.');
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

    if (!isFeatureAllowed) {
      setErrorMessage('An API Key is required for Editorial Vocabulary Extractor. Please add your Gemini key in Settings or request access from your Administrator.');
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
          {/* STEP 1: SOURCE INGESTION */}
          {currentStep === 1 && (
            <ExtractionStep1Source
              sourceType={sourceType}
              setSourceType={setSourceType}
              setErrorMessage={setErrorMessage}
              youtubeUrl={youtubeUrl}
              setYoutubeUrl={setYoutubeUrl}
              useCustomRange={useCustomRange}
              setUseCustomRange={setUseCustomRange}
              startTimeStr={startTimeStr}
              setStartTimeStr={setStartTimeStr}
              endTimeStr={endTimeStr}
              setEndTimeStr={setEndTimeStr}
              isLoading={isLoading}
              loadingMessage={loadingMessage}
              handleFetchYouTubeTranscript={handleFetchYouTubeTranscript}
              setSourceMetadata={setSourceMetadata}
              setCurrentStep={setCurrentStep}
              fileInputRef={fileInputRef}
              handleFileInputChange={handleFileInputChange}
              selectedFile={selectedFile}
              pageRange={pageRange}
              setPageRange={setPageRange}
              handleProcessDocumentFile={handleProcessDocumentFile}
              imagePreviewUrl={imagePreviewUrl}
              rawText={rawText}
              setRawText={setRawText}
              handleProceedWithRawText={handleProceedWithRawText}
            />
          )}

          {/* STEP 2: RAW TEXT VERIFICATION & AI PROMPT INJECTION */}
          {currentStep === 2 && (
            <ExtractionStep2Verify
              sourceType={sourceType}
              sourceMetadata={sourceMetadata}
              rawWordCount={rawWordCount}
              copied={copied}
              handleCopyRawText={handleCopyRawText}
              rawText={rawText}
              setRawText={setRawText}
              customInstructions={customInstructions}
              setCustomInstructions={setCustomInstructions}
              showInstructionField={showInstructionField}
              setShowInstructionField={setShowInstructionField}
              defaultsLoaded={defaultsLoaded}
              globalDefaults={globalDefaults}
              setCurrentStep={setCurrentStep}
              handleGenerateVocabulary={handleGenerateVocabulary}
              isLoading={isLoading}
              loadingMessage={loadingMessage}
            />
          )}

          {/* STEP 3: SINGLE PAGE DOCUMENT VIEW & MARKDOWN EDITOR */}
          {currentStep === 3 && (
            <ExtractionStep3Staging
              stagingTitle={stagingTitle}
              setStagingTitle={setStagingTitle}
              stagingWords={stagingWords}
              stagingIdioms={stagingIdioms}
              stagingMarkdown={stagingMarkdown}
              setStagingMarkdown={setStagingMarkdown}
              step3ViewMode={step3ViewMode}
              setStep3ViewMode={setStep3ViewMode}
              copiedMarkdown={copiedMarkdown}
              handleCopyMarkdown={handleCopyMarkdown}
              handleDownloadMarkdown={handleDownloadMarkdown}
              stagingSearch={stagingSearch}
              setStagingSearch={setStagingSearch}
              handleAddNewWord={handleAddNewWord}
              handleAddNewIdiom={handleAddNewIdiom}
              filteredWords={filteredWords}
              filteredIdioms={filteredIdioms}
              editingWordId={editingWordId}
              setEditingWordId={setEditingWordId}
              handleUpdateWord={handleUpdateWord}
              handleDeleteWord={handleDeleteWord}
              editingIdiomId={editingIdiomId}
              setEditingIdiomId={setEditingIdiomId}
              handleUpdateIdiom={handleUpdateIdiom}
              handleDeleteIdiom={handleDeleteIdiom}
              handleMarkdownChange={handleMarkdownChange}
              setCurrentStep={setCurrentStep}
              handleApproveAndCommit={handleApproveAndCommit}
            />
          )}

          {/* STEP 4: SUCCESS / COMMITTED CONFIRMATION */}
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
