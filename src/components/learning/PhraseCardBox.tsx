import React, { useState, useRef, useEffect } from 'react';
import { Star, Folder } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { useVocabularyStore } from '../../store/vocabularyStore';
import { MoveVocabDialog } from './MoveVocabDialog';

interface PhraseCardBoxProps {
  item: {
    id: string;
    word: string;
    type?: string;
    meaning?: string;
    example?: string;
    canvasId?: string;
    canvasTitle?: string;
    canvasDate?: string;
  };
  canManageLearning?: boolean;
}

export function PhraseCardBox({
  item,
  canManageLearning = false,
}: PhraseCardBoxProps) {
  const favoriteVocabIds = useVocabularyStore((state) => state.favoriteVocabIds);
  const toggleFavorite = useVocabularyStore((state) => state.toggleFavorite);
  const customFolders = useVocabularyStore((state) => state.customFolders);
  const updateTextEntry = useVocabularyStore((state) => state.updateTextEntry);

  const isStarred = favoriteVocabIds.includes(item.id);
  const isInCustomFolder = customFolders.some((f) => f.vocabIds?.includes(item.id));

  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleStar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const willBeStarred = !isStarred;
    toggleFavorite(item.id);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(willBeStarred ? 'Added to Favorites' : 'Removed from Favorites');
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  };

  const getStyleForType = (type?: string) => {
    switch (type) {
      case 'phrasal_verb':
      case 'phrasalVerbs':
        return 'bg-[#f0f5ff] dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30 focus-within:border-blue-300 dark:focus-within:border-blue-500/50';
      case 'idiom':
      case 'idioms':
      case 'idioms_phrase':
        return 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30 focus-within:border-amber-300 dark:focus-within:border-amber-500/50';
      case 'one_word_sub':
      case 'oneWordSubs':
      case 'one_word_substitution':
        return 'bg-[#f6f0ff] dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30 focus-within:border-purple-300 dark:focus-within:border-purple-500/50';
      default:
        return 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50';
    }
  };

  const getTextColorForType = (type?: string) => {
    switch (type) {
      case 'phrasal_verb':
      case 'phrasalVerbs':
        return '!text-[#4883ff]';
      case 'idiom':
      case 'idioms':
      case 'idioms_phrase':
        return '!text-amber-600 dark:!text-amber-400';
      case 'one_word_sub':
      case 'oneWordSubs':
      case 'one_word_substitution':
        return '!text-[#b75afa] dark:!text-purple-400';
      default:
        return '!text-slate-800 dark:!text-slate-100';
    }
  };

  const hasEmbeddedExample =
    item.type !== 'idiom' &&
    item.type !== 'idioms' &&
    item.type !== 'idioms_phrase' &&
    !item.example &&
    typeof item.meaning === 'string' &&
    item.meaning.match(/Example:\s*(.*)/i);

  const displayMeaning = hasEmbeddedExample
    ? item.meaning.replace(/Example:\s*(.*)/i, '').trim()
    : typeof item.meaning === 'string'
    ? item.meaning.trim()
    : item.meaning || '';

  const displayExample =
    typeof (item.example || (hasEmbeddedExample ? hasEmbeddedExample[1] : '')) === 'string'
      ? (item.example || (hasEmbeddedExample ? hasEmbeddedExample[1] : '')).trim()
      : item.example || (hasEmbeddedExample ? hasEmbeddedExample[1] : '');

  const handleUpdate = (updates: { text?: string; meaning?: string; example?: string }) => {
    if (!item.canvasId) return;
    const storeType =
      item.type === 'phrasal_verb'
        ? 'phrasalVerbs'
        : item.type === 'idiom' || item.type === 'idioms_phrase'
        ? 'idioms'
        : 'oneWordSubs';
    updateTextEntry(item.canvasId, storeType, item.id, updates);
  };

  const styleClasses = getStyleForType(item.type);
  const textColorClass = getTextColorForType(item.type);

  return (
    <div
      className={`relative flex flex-col gap-1 p-3.5 border rounded-lg group transition-colors shadow-xs ${styleClasses}`}
    >
      {/* Item Actions (Folder, Star) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {toastMessage && (
          <div className="px-2.5 py-0.5 bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-semibold rounded-full shadow-md whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-right-2 duration-200">
            {toastMessage}
          </div>
        )}

        {/* Move to Folder Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsMoveDialogOpen(true);
          }}
          className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            isInCustomFolder
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50'
              : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={isInCustomFolder ? 'Organized in folder (click to change)' : 'Move to folder'}
        >
          <Folder
            className={`w-4 h-4 transition-transform active:scale-125 ${
              isInCustomFolder ? 'fill-indigo-500/20' : ''
            }`}
          />
        </button>

        {/* Star Button */}
        <button
          type="button"
          onClick={handleToggleStar}
          className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            isStarred
              ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60'
              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
          }`}
          title={isStarred ? 'Remove from Favorites' : 'Add to Favorites'}
        >
          <Star
            className={`w-4 h-4 transition-transform active:scale-125 ${
              isStarred ? 'fill-amber-400 text-amber-500' : ''
            }`}
          />
        </button>
      </div>

      {/* Term / Phrase title */}
      <TextareaAutosize
        placeholder="Term/Phrase"
        value={item.word}
        onChange={(e) => handleUpdate({ text: e.target.value })}
        readOnly={!canManageLearning || !item.canvasId}
        className={`font-semibold text-base bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full pr-20 resize-none ${textColorClass}`}
      />

      {/* Meaning */}
      <TextareaAutosize
        placeholder="Meaning"
        value={displayMeaning}
        onChange={(e) =>
          handleUpdate({
            meaning: e.target.value,
            ...(hasEmbeddedExample ? { example: displayExample } : {}),
          })
        }
        readOnly={!canManageLearning || !item.canvasId}
        className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full whitespace-pre-wrap break-words resize-none"
      />

      {/* Divider and Example (Phrasal Verbs and One Word Substitutions only; excluded for Idioms & Phrases) */}
      {item.type !== 'idiom' &&
        item.type !== 'idioms' &&
        item.type !== 'idioms_phrase' &&
        (displayExample || (canManageLearning && item.canvasId)) && (
          <>
            <div className="h-px w-full bg-slate-200 dark:bg-slate-800/80 my-0.5" />
            <TextareaAutosize
              placeholder="Example (optional)"
              value={displayExample}
              onChange={(e) => {
                if (hasEmbeddedExample) {
                  handleUpdate({
                    meaning: displayMeaning,
                    example: e.target.value,
                  });
                } else {
                  handleUpdate({
                    example: e.target.value,
                  });
                }
              }}
              readOnly={!canManageLearning || !item.canvasId}
              className="text-sm text-slate-500 dark:text-slate-400 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 w-full italic whitespace-pre-wrap break-words resize-none"
            />
          </>
        )}

      {/* Move Vocab Dialog */}
      <MoveVocabDialog
        isOpen={isMoveDialogOpen}
        onClose={() => setIsMoveDialogOpen(false)}
        vocabId={item.id}
        vocabWord={item.word}
      />
    </div>
  );
}
