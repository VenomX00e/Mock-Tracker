import React, { useState, useContext, useEffect } from 'react';
import { AppStateCtx } from '../../context/AppContext';
import { useVocabularyStore } from '../../store/vocabularyStore';
import { Plus, BookOpen, Calendar, Trash2, Youtube, Sparkles, BookMarked, Star } from 'lucide-react';
import { EditorialCanvasView } from './EditorialCanvasView';
import { YouTubeVocabExtractorModal } from './YouTubeVocabExtractorModal';
import { jarvisEventBus, JarvisActionEvent } from '../../features/jarvis/utils/eventBus';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { RuleBookDashboard } from '../vocabulary/RuleBookDashboard';
import { MyVocabsView } from './MyVocabsView';

export function VocabularyFeed() {
  const { isOwner, adminPermissions } = useContext(AppStateCtx)!;
  const canManageLearning = isOwner || adminPermissions?.canManageLearning;

  const { canvases, addCanvas, deleteCanvas } = useVocabularyStore();
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [subTab, setSubTab] = useState<'vocabs' | 'my-vocabs' | 'rules'>('vocabs');

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-canvas-id]")) {
        setActiveDeleteId(null);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  const [filterQuery, setFilterQuery] = useState('');

  const normalizeDateString = (str: string): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/(st|nd|rd|th)/gi, '')
      .replace(/january/g, 'jan')
      .replace(/february/g, 'feb')
      .replace(/march/g, 'mar')
      .replace(/april/g, 'apr')
      .replace(/may/g, 'may')
      .replace(/june/g, 'jun')
      .replace(/july/g, 'jul')
      .replace(/august/g, 'aug')
      .replace(/september/g, 'sep')
      .replace(/october/g, 'oct')
      .replace(/november/g, 'nov')
      .replace(/december/g, 'dec')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  useEffect(() => {
    const handleJarvisAction = (action: JarvisActionEvent) => {
      if (action.type === 'EXECUTE_INTENT') {
        if (action.intent === 'OPEN_MY_VOCABS' || action.intent === 'OPEN_FAVORITE_VOCAB') {
          setSubTab('my-vocabs');
          setActiveCanvasId(null);
          return;
        }

        if (
          action.intent === 'OPEN_VOCAB_CANVAS' ||
          action.intent === 'FILTER_VOCAB_DATE' ||
          action.intent === 'OPEN_EDITORIAL_VOCAB' ||
          action.intent === 'FILTER_VOCABULARY_BY_DATE'
        ) {
          const payload = action.payload || {};
          const target = action.query || payload.date || payload.searchQuery || (action as any).target || '';
          if (!target) return;

          setFilterQuery(target);

          const queryNorm = normalizeDateString(target);

          const matchedCanvas = canvases.find(c => {
            const titleNorm = normalizeDateString(c.title);
            let formattedDate = '';
            try {
              formattedDate = new Date(c.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            } catch {
              formattedDate = c.date;
            }
            const dateNorm = normalizeDateString(formattedDate);
            const rawDateNorm = normalizeDateString(c.date);

            return (
              (titleNorm && queryNorm.includes(titleNorm)) ||
              (titleNorm && titleNorm.includes(queryNorm)) ||
              (dateNorm && queryNorm.includes(dateNorm)) ||
              (dateNorm && dateNorm.includes(queryNorm)) ||
              (rawDateNorm && queryNorm.includes(rawDateNorm))
            );
          });

          if (matchedCanvas) {
            setSubTab('vocabs');
            setActiveCanvasId(matchedCanvas.id);
          }
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleJarvisAction);
    return () => unsubscribe();
  }, [canvases]);

  const handleCreateCanvas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addCanvas({
      title: newTitle,
      date: new Date().toISOString(),
    });
    setNewTitle('');
    setIsCreating(false);
  };

  if (activeCanvasId) {
    return <EditorialCanvasView canvasId={activeCanvasId} onBack={() => setActiveCanvasId(null)} />;
  }

  return (
    <div className="w-full h-full flex flex-col gap-5">
      {/* Subpage Tabs Navigation: Editorial Vocabs vs. My Vocabs vs. RuleBook */}
      <Tabs value={subTab} onValueChange={(val) => setSubTab(val as 'vocabs' | 'my-vocabs' | 'rules')}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
          <TabsList>
            <TabsTrigger value="vocabs" icon={<BookOpen className="w-4 h-4" />}>
              Editorial Vocab
            </TabsTrigger>
            <TabsTrigger value="my-vocabs" icon={<Star className="w-4 h-4 text-amber-500 fill-amber-400" />}>
              My Vocabs
            </TabsTrigger>
            <TabsTrigger value="rules" icon={<BookMarked className="w-4 h-4 text-amber-500" />}>
              RuleBook
            </TabsTrigger>
          </TabsList>

          {subTab === 'vocabs' && canManageLearning && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsYouTubeModalOpen(true)}
                className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-3.5 md:py-1.5 text-xs md:text-sm bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm cursor-pointer outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                title="Extract vocabulary from YouTube video transcript"
              >
                <Youtube className="w-4 h-4" />
                <span className="hidden sm:inline">From YouTube</span>
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-3.5 md:py-1.5 text-xs md:text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-sm cursor-pointer outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <Plus className="w-4 h-4" />
                <span>New Canvas</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Editorial Vocabulary Canvases */}
        <TabsContent value="vocabs">
          <div className="flex flex-col gap-6">
            {isCreating && (
              <div className="p-5 bg-white dark:bg-[#1E1F25] border border-indigo-200 dark:border-indigo-500/30 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                <form onSubmit={handleCreateCanvas} className="flex flex-col sm:flex-row gap-4 sm:items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Class/Canvas Title</label>
                    <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                      type="text"
                      autoFocus
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Nimisha Bansal - 24 May"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-white text-sm transition-colors"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="flex-1 sm:flex-none px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newTitle.trim()}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            )}

            {canvases.length === 0 && !isCreating ? (
              <div className="text-center py-24 bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 border-dashed rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm">
                <div className="w-16 h-16 bg-white dark:bg-white/5 text-slate-400 dark:text-slate-300 rounded-2xl flex items-center justify-center mb-4 shadow-sm backdrop-blur-md border border-slate-100 dark:border-white/5">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-2">No class canvases yet</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                  {canManageLearning ? "Create a canvas to start organizing today's vocabulary, idioms, and phrasal verbs." : "Check back later for new editorial vocabs."}
                </p>
                {canManageLearning && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-700 dark:text-white font-medium rounded-lg transition-colors shadow-sm backdrop-blur-md"
                  >
                    <Plus className="w-4 h-4" /> Start First Canvas
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {canvases.map((canvas) => (
                  <div 
                    key={canvas.id} 
                    data-canvas-id={canvas.id}
                    onClick={() => {
                      if (canManageLearning && activeDeleteId !== canvas.id) {
                        setActiveDeleteId(canvas.id);
                      } else {
                        setActiveCanvasId(canvas.id);
                      }
                    }}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md rounded-xl p-5 transition-all group flex flex-col cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-base md:text-lg text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{canvas.title}</h3>
                      {canManageLearning && activeDeleteId === canvas.id && (
                        <button 
                          onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            deleteCanvas(canvas.id); 
                          }}
                          className="p-1 px-2 -mr-1.5 -mt-1.5 text-[10px] md:text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm animate-in fade-in zoom-in"
                          title="Delete Canvas"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center text-[10px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(canvas.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/80 flex gap-2 w-full justify-between items-center text-xs md:text-sm">
                       <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 px-2 md:px-2.5 py-0.5 md:py-1 rounded-md font-bold tracking-tight text-xs md:text-sm">
                         {canvas.vocabularies.length} <span className="font-medium opacity-80">Words</span>
                       </span>
                       <span className="text-slate-500 dark:text-slate-500 font-medium text-[10px] md:text-xs">
                          {(canvas.phrasalVerbs?.length || 0) + (canvas.idioms?.length || 0) + (canvas.oneWordSubs?.length || 0)} Extras
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: My Vocabs (Favorites & Custom Folders) */}
        <TabsContent value="my-vocabs">
          <MyVocabsView />
        </TabsContent>

        {/* Tab 3: Personal RuleBook Dashboard */}
        <TabsContent value="rules">
          <RuleBookDashboard />
        </TabsContent>
      </Tabs>

      {/* YouTube Vocabulary Extractor Modal */}
      <YouTubeVocabExtractorModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onSuccess={(canvasId) => {
          setIsYouTubeModalOpen(false);
          setActiveCanvasId(canvasId);
        }}
      />
    </div>
  );
}
