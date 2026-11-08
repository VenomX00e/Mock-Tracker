import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Bookmark,
  BookOpen,
  Zap,
  Sparkles,
  FileText,
  Folder,
  FolderPlus,
  Plus,
  Trash2,
  Search,
  Loader2,
  FolderOpen,
  Filter,
  Check,
  X,
  Layers,
  Calendar,
  Activity,
  Lightbulb,
  Type,
  AlertCircle,
} from 'lucide-react';
import { useVocabularyStore, VocabEntry } from '../../store/vocabularyStore';
import { useAppStateCtx } from '../../context/AppContext';
import { VocabWordBox } from './VocabWordBox';
import { PhraseCardBox } from './PhraseCardBox';
import { fetchVocabulariesInChunks } from '../../services/vocabularyFirebaseService';
import { Vocabulary } from '../../types';
import { VocabQuizContainer } from './quiz/VocabQuizContainer';

type PredefinedCategory =
  | 'all'
  | 'vocab'
  | 'phrasal_verb'
  | 'idiom'
  | 'one_word_sub'
  | 'wrong';

interface PredefinedTabDef {
  id: PredefinedCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PREDEFINED_TABS: PredefinedTabDef[] = [
  { id: 'all', label: 'All Saved', icon: Bookmark },
  { id: 'vocab', label: 'Vocabs', icon: BookOpen },
  { id: 'phrasal_verb', label: 'Phrasal Verbs', icon: Zap },
  { id: 'idiom', label: 'Idioms & Phrases', icon: Sparkles },
  { id: 'one_word_sub', label: 'One Word Substitutions', icon: FileText },
  { id: 'wrong', label: 'Wrong', icon: AlertCircle },
];

export function MyVocabsView() {
  const { isOwner, adminPermissions } = useAppStateCtx();
  const canManageLearning = Boolean(isOwner || adminPermissions?.canManageLearning);

  const {
    favoriteVocabIds,
    wrongVocabIds,
    customFolders,
    canvases,
    favoritedVocabsData,
    createCustomFolder,
    deleteCustomFolder,
    removeVocabFromFolder,
    removeWrongVocab,
    toggleFavorite,
    updateVocab,
  } = useVocabularyStore();

  // Active filter: predefined category ID or a custom folder ID
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchedWords, setFetchedWords] = useState<Vocabulary[]>(favoritedVocabsData);

  // Modal / input state for Create Folder
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderDeleteConfirmId, setFolderDeleteConfirmId] = useState<string | null>(null);

  // Fetch actual word data for favoriteVocabIds from Firestore in chunks of 30
  useEffect(() => {
    let isCancelled = false;

    async function loadWords() {
      if (favoriteVocabIds.length === 0) {
        setFetchedWords([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await fetchVocabulariesInChunks(favoriteVocabIds, canvases);
        if (!isCancelled) {
          setFetchedWords(results);
        }
      } catch (err) {
        console.error('Failed to fetch favorited words in chunks:', err);
        // Fallback to instantly computed store data
        if (!isCancelled) {
          setFetchedWords(favoritedVocabsData);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWords();

    return () => {
      isCancelled = true;
    };
  }, [favoriteVocabIds, canvases]);

  // Keep fetched words updated optimistically if favoritedVocabsData updates
  useEffect(() => {
    if (favoritedVocabsData.length > 0 && fetchedWords.length === 0) {
      setFetchedWords(favoritedVocabsData);
    }
  }, [favoritedVocabsData]);

  // Selected custom folder if activeTab is not predefined
  const activeCustomFolder = useMemo(() => {
    return customFolders.find((f) => f.id === activeTab) || null;
  }, [customFolders, activeTab]);

  // Tab counts
  const counts = useMemo(() => {
    const wrongSet = new Set(wrongVocabIds);
    return {
      all: fetchedWords.length,
      vocab: fetchedWords.filter((w) => w.type === 'vocab').length,
      phrasal_verb: fetchedWords.filter((w) => w.type === 'phrasal_verb').length,
      idiom: fetchedWords.filter((w) => w.type === 'idiom').length,
      one_word_sub: fetchedWords.filter((w) => w.type === 'one_word_sub').length,
      wrong: fetchedWords.filter((w) => wrongSet.has(w.id)).length,
    };
  }, [fetchedWords, wrongVocabIds]);

  // Main Filtering Logic:
  // Predefined tabs: data.filter(word => word.type === ...)
  // Custom folder: data.filter(word => folder.vocabIds.includes(word.id))
  const filteredWords = useMemo(() => {
    let result = fetchedWords;

    if (activeTab === 'all') {
      result = fetchedWords;
    } else if (activeTab === 'vocab') {
      result = fetchedWords.filter((word) => word.type === 'vocab');
    } else if (activeTab === 'phrasal_verb') {
      result = fetchedWords.filter((word) => word.type === 'phrasal_verb');
    } else if (activeTab === 'idiom') {
      result = fetchedWords.filter((word) => word.type === 'idiom');
    } else if (activeTab === 'one_word_sub') {
      result = fetchedWords.filter((word) => word.type === 'one_word_sub');
    } else if (activeTab === 'wrong') {
      const wrongSet = new Set(wrongVocabIds);
      result = fetchedWords.filter((word) => wrongSet.has(word.id));
    } else if (activeCustomFolder) {
      const folderSet = new Set(activeCustomFolder.vocabIds || []);
      result = fetchedWords.filter((word) => folderSet.has(word.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (w) =>
          w.word.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q) ||
          (w.example && w.example.toLowerCase().includes(q)) ||
          (w.synonyms && w.synonyms.some((s) => s.toLowerCase().includes(q))) ||
          (w.additional && w.additional.toLowerCase().includes(q)) ||
          (w.canvasTitle && w.canvasTitle.toLowerCase().includes(q))
      );
    }

    return result;
  }, [fetchedWords, activeTab, activeCustomFolder, searchQuery, wrongVocabIds]);

  // Split items by category for the editorial "All Saved" 2-column view
  const allVocabWords = useMemo(
    () => filteredWords.filter((w) => w.type === 'vocab'),
    [filteredWords]
  );
  const allPhrasalVerbWords = useMemo(
    () => filteredWords.filter((w) => w.type === 'phrasal_verb'),
    [filteredWords]
  );
  const allIdiomWords = useMemo(
    () => filteredWords.filter((w) => w.type === 'idiom'),
    [filteredWords]
  );
  const allOneWordSubWords = useMemo(
    () => filteredWords.filter((w) => w.type === 'one_word_sub'),
    [filteredWords]
  );

  // Create folder handler
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    try {
      const newFolder = await createCustomFolder(trimmed);
      setNewFolderName('');
      setIsCreatingFolder(false);
      if (newFolder) {
        setActiveTab(newFolder.id);
      }
    } catch (err) {
      console.error('Error creating custom folder:', err);
    }
  };

  // Delete folder handler
  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteCustomFolder(folderId);
      setFolderDeleteConfirmId(null);
      if (activeTab === folderId) {
        setActiveTab('all');
      }
    } catch (err) {
      console.error('Error deleting custom folder:', err);
    }
  };

  // Active section title for breadcrumbs / header
  const currentSectionTitle = useMemo(() => {
    const predefined = PREDEFINED_TABS.find((t) => t.id === activeTab);
    if (predefined) return predefined.label;
    if (activeCustomFolder) return activeCustomFolder.name;
    return 'Saved Vocabulary';
  }, [activeTab, activeCustomFolder]);

  return (
    <div className="w-full flex flex-col gap-6 min-h-[600px] animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* HORIZONTAL FILTER BAR (Unified Across All Screen Sizes)                    */}
      {/* ========================================================================= */}
      <nav className="w-full bg-white dark:bg-[#151b28] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Filter by
          </span>
          <button
            type="button"
            onClick={() => setIsCreatingFolder((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30"
            title="Create new personal folder"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Folder</span>
          </button>
        </div>

        {/* Inline Folder Creation Form */}
        {isCreatingFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="mb-3 p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-indigo-200 dark:border-indigo-800/50 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
          >
            <input
              type="text"
              autoFocus
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name (e.g. Exam Prep, Hard Words)..."
              className="flex-1 px-3 py-1.5 text-xs md:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 text-slate-800 dark:text-white"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Create Folder
              </button>
            </div>
          </form>
        )}

        {/* Horizontal Scrollable Chips Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5">
          {/* Predefined Categories */}
          {PREDEFINED_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = counts[tab.id];
            const isWrongTab = tab.id === 'wrong';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? isWrongTab
                      ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/20'
                      : 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/20'
                    : isWrongTab && count > 0
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? 'text-white'
                      : isWrongTab
                      ? 'text-rose-500'
                      : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : isWrongTab && count > 0
                      ? 'bg-rose-200/70 dark:bg-rose-900/70 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Divider between Predefined and Custom Folders */}
          {customFolders.length > 0 && (
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
          )}

          {/* Custom Folders Chips */}
          {customFolders.map((folder) => {
            const isActive = activeTab === folder.id;
            const count = folder.vocabIds?.length || 0;
            const isConfirmingDelete = folderDeleteConfirmId === folder.id;

            return (
              <div
                key={folder.id}
                className={`group relative inline-flex items-center rounded-full transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/20'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab(folder.id)}
                  className="flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Folder
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-white' : 'text-amber-500'
                    }`}
                  />
                  <span>{folder.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>

                {/* Inline delete confirmation or delete icon for custom folders */}
                <div className="pr-2 flex items-center">
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-full px-1.5 py-0.5 shadow-xs border border-red-200 dark:border-red-800 animate-in fade-in">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="p-0.5 text-red-600 hover:text-red-700"
                        title="Confirm delete"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderDeleteConfirmId(null);
                        }}
                        className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderDeleteConfirmId(folder.id);
                      }}
                      className={`p-0.5 rounded-full transition-opacity cursor-pointer ${
                        isActive
                          ? 'text-amber-100 hover:text-white'
                          : 'opacity-40 hover:opacity-100 text-slate-400 hover:text-red-500'
                      }`}
                      title={`Delete "${folder.name}"`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA: SEARCH, HEADER, & VOCABWORDBOX GRID                    */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                {activeCustomFolder ? (
                  <Folder className="w-5 h-5 text-amber-500" />
                ) : (
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                )}
                <span>{currentSectionTitle}</span>
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {filteredWords.length} {filteredWords.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeCustomFolder
                ? `Custom collection · ${activeCustomFolder.vocabIds?.length || 0} saved words`
                : 'Personal favorite vocabulary repository with instant filtering'}
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by word, meaning..."
              className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-white placeholder:text-slate-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && fetchedWords.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Retrieving your saved vocabulary...
            </p>
          </div>
        )}

        {/* Empty States */}
        {!isLoading && favoriteVocabIds.length === 0 && (
          <div className="text-center py-20 bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 border-dashed rounded-2xl flex flex-col items-center justify-center p-6">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-2xl flex items-center justify-center mb-4 shadow-xs border border-amber-200/60 dark:border-amber-900/40">
              <Star className="w-7 h-7 fill-amber-400" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 mb-1.5">
              No saved vocabulary yet
            </h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4 leading-relaxed">
              Star words from the <strong>Editorial Vocab</strong> canvas feed to save them here.
              Organize terms into custom study folders for quick daily revision.
            </p>
          </div>
        )}

        {!isLoading && favoriteVocabIds.length > 0 && filteredWords.length === 0 && (
          <div className="text-center py-16 bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 border-dashed rounded-2xl flex flex-col items-center justify-center p-6">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl flex items-center justify-center mb-3">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
              No matching items found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {searchQuery
                ? `No vocabulary matching "${searchQuery}" in ${currentSectionTitle}.`
                : `You don't have any items under ${currentSectionTitle} yet.`}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear search query
              </button>
            )}
          </div>
        )}

        {/* Word Cards Display */}
        {filteredWords.length > 0 && (() => {
          const renderCardItem = (item: Vocabulary) => {
            const isPhraseType =
              item.type === 'phrasal_verb' ||
              item.type === 'idiom' ||
              item.type === 'one_word_sub';

            const vocabEntry: VocabEntry = {
              id: item.id,
              word: item.word,
              pos: item.pos || 'Vocab',
              meaning: item.meaning || '',
              example: item.example || '',
              synonyms: item.synonyms || [],
              antonyms: item.antonyms || [],
              mnemonic: item.mnemonic || '',
              additional: item.additional || '',
              isMastered: item.isMastered,
            };

            const cleanDate = item.canvasDate
              ? item.canvasDate.includes('T')
                ? item.canvasDate.split('T')[0]
                : item.canvasDate
              : '';

            return (
              <div key={item.id} className="relative flex flex-col">
                {/* Source Canvas Attribution Badge */}
                {item.canvasTitle && (
                  <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md font-medium text-slate-600 dark:text-slate-300">
                      <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[170px] sm:max-w-[210px]">
                        {item.canvasTitle}
                      </span>
                    </span>
                    {item.type && item.type !== 'vocab' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}

                {isPhraseType ? (
                  <PhraseCardBox
                    item={item}
                    canManageLearning={canManageLearning}
                  />
                ) : (
                  <VocabWordBox
                    vocab={vocabEntry}
                    isMyVocabsView={true}
                    onUpdate={(updates) => {
                      if (item.canvasId) {
                        updateVocab(item.canvasId, item.id, updates);
                      }
                    }}
                    onDelete={() => {
                      if (activeTab === 'wrong') {
                        removeWrongVocab(item.id);
                      } else if (activeCustomFolder) {
                        removeVocabFromFolder(activeCustomFolder.id, item.id);
                      } else {
                        toggleFavorite(item.id);
                      }
                    }}
                    canManageLearning={canManageLearning}
                  />
                )}

                {/* Active folder removal pill if inside custom folder or Wrong tab */}
                {activeTab === 'wrong' && (
                  <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-slate-500">
                    <span className="text-rose-500 dark:text-rose-400 font-medium">
                      Saved in Wrong list
                    </span>
                    <button
                      type="button"
                      onClick={() => removeWrongVocab(item.id)}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                    >
                      Mark Mastered · Remove from Wrong
                    </button>
                  </div>
                )}

                {activeCustomFolder && (
                  <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-slate-500">
                    <span>Folder: {activeCustomFolder.name}</span>
                    <button
                      type="button"
                      onClick={() => removeVocabFromFolder(activeCustomFolder.id, item.id)}
                      className="text-red-500 hover:text-red-600 hover:underline font-medium cursor-pointer"
                    >
                      Remove from folder
                    </button>
                  </div>
                )}
              </div>
            );
          };

          if (activeTab === 'all') {
            return (
              <div className="w-full grid grid-cols-1 lg:grid-cols-8 gap-6 items-start">
                {/* Left Column: Vocabulary */}
                <div className="w-full lg:col-span-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4 pt-1 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                      <Type className="w-4 h-4 text-indigo-500" />
                      <span>Vocabulary</span>
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      {allVocabWords.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    {allVocabWords.map(renderCardItem)}
                    {allVocabWords.length === 0 && (
                      <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-400">
                        No saved vocabulary words
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Other Categories (Phrasal Verbs, Idioms & Phrases, One Word Substitutions) */}
                <div className="w-full lg:col-span-3 flex flex-col gap-6">
                  {/* Phrasal Verbs Section */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3 pt-1 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <span>Phrasal Verbs</span>
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        {allPhrasalVerbWords.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {allPhrasalVerbWords.map(renderCardItem)}
                      {allPhrasalVerbWords.length === 0 && (
                        <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-400">
                          No saved phrasal verbs
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Idioms & Phrases Section */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3 pt-1 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span>Idioms & Phrases</span>
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                        {allIdiomWords.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {allIdiomWords.map(renderCardItem)}
                      {allIdiomWords.length === 0 && (
                        <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-400">
                          No saved idioms & phrases
                        </div>
                      )}
                    </div>
                  </div>

                  {/* One Word Substitutions Section */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-3 pt-1 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                        <Type className="w-4 h-4 text-purple-500" />
                        <span>One Word Substitutions</span>
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                        {allOneWordSubWords.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {allOneWordSubWords.map(renderCardItem)}
                      {allOneWordSubWords.length === 0 && (
                        <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl text-xs text-slate-400">
                          No saved one word substitutions
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Other sections (Vocabs, Phrasal Verbs, Idioms & Phrases, One Word Substitutions, and Folders): Exactly 2 boxes in a row
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWords.map(renderCardItem)}
            </div>
          );
        })()}
      </main>

      {/* Floating AI Vocab Quiz Trigger & Modal Flow */}
      <VocabQuizContainer
        words={filteredWords}
        title="AI Vocab Quiz"
      />
    </div>
  );
}
