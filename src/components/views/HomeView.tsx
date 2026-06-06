import React, { useState, useRef, useEffect } from 'react';
import { useAuthCtx, useUserProfileCtx, useAppStateCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { useSystemDocsQuery } from '../../hooks/useSystemDocsQuery';
import { ActivityMap } from '../dashboard/ActivityMap';
import { Calendar, Settings, CalendarDays, Gamepad2, Sun, Moon, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export function HomeView() {
  const { user } = useAuthCtx();
  const { profile } = useUserProfileCtx();
  const { isOwner, adminPermissions } = useAppStateCtx();
  const { theme, setTheme, setActiveTab } = useUIStore();
  const { quotesConfig, mutateSystemDocs } = useSystemDocsQuery();
  
  const canEditQuotes = isOwner || adminPermissions?.canManageQuotes;

  const [quoteControlsVisible, setQuoteControlsVisible] = useState(false);
  const [manualQuoteIdx, setManualQuoteIdx] = useState<number | null>(null);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const quoteContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quoteContainerRef.current && !quoteContainerRef.current.contains(e.target as Node)) {
        setQuoteControlsVisible(false);
      }
    };
    if (quoteControlsVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quoteControlsVisible]);

  // Greeting logic
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 18) greeting = 'Good Afternoon';

  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const formattedDate = today.toLocaleDateString('en-US', dateOptions);

  // Compute Quote based on quotesConfig
  const getActiveQuote = () => {
    const defaultQuote = { text: "Don't watch the clock; do what it does. Keep going.", author: "SAM LEVENSON", index: 0 };
    if (!quotesConfig || !quotesConfig.quotes || quotesConfig.quotes.length === 0) {
      return defaultQuote;
    }
    const duration = quotesConfig.rotationDuration || '1d';
    const customHours = quotesConfig.customDurationHours || 24;
    let durationMs = 24 * 60 * 60 * 1000;
    if (duration === '6h') durationMs = 6 * 60 * 60 * 1000;
    else if (duration === '12h') durationMs = 12 * 60 * 60 * 1000;
    else if (duration === '1d') durationMs = 24 * 60 * 60 * 1000;
    else if (duration === '2d') durationMs = 48 * 60 * 60 * 1000;
    else if (duration === 'custom') durationMs = customHours * 60 * 60 * 1000;
    
    // Fallback in case of weird math
    if (durationMs <= 0) durationMs = 24 * 60 * 60 * 1000;
    
    if (manualQuoteIdx !== null) {
      return { ...quotesConfig.quotes[manualQuoteIdx], index: manualQuoteIdx };
    }
    
    if (quotesConfig.lastRotatedAt !== undefined && quotesConfig.currentQuoteIdx !== undefined) {
      const elapsed = Date.now() - quotesConfig.lastRotatedAt;
      const ticks = Math.floor(elapsed / durationMs);
      const newIndex = (quotesConfig.currentQuoteIdx + ticks) % quotesConfig.quotes.length;
      return { ...quotesConfig.quotes[newIndex], index: newIndex };
    }

    const index = Math.floor(Date.now() / durationMs) % quotesConfig.quotes.length;
    return { ...quotesConfig.quotes[index], index };
  };
  
  const activeQuote = getActiveQuote();

  const handlePrevQuote = () => {
    if (!quotesConfig?.quotes?.length) return;
    const currentIdx = activeQuote.index;
    const newIdx = currentIdx - 1 < 0 ? quotesConfig.quotes.length - 1 : currentIdx - 1;
    setManualQuoteIdx(newIdx);
  };

  const handleNextQuote = () => {
    if (!quotesConfig?.quotes?.length) return;
    const currentIdx = activeQuote.index;
    const newIdx = (currentIdx + 1) % quotesConfig.quotes.length;
    setManualQuoteIdx(newIdx);
  };

  const handleSaveQuote = async () => {
    if (!canEditQuotes || manualQuoteIdx === null || !quotesConfig) return;
    setIsSavingQuote(true);
    try {
      const docRef = doc(db, "system", "quotesConfig");
      await setDoc(docRef, {
        currentQuoteIdx: manualQuoteIdx,
        lastRotatedAt: Date.now()
      }, { merge: true });
      mutateSystemDocs();
      setManualQuoteIdx(null); // Return to auto-rotation using the new saved baseline
      setQuoteControlsVisible(false);
    } catch(err) {
      console.error("Error saving current quote", err);
    } finally {
      setIsSavingQuote(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 mt-2 md:mt-0">
      {/* Header Area */}
      <div className="flex flex-col mb-4 sm:mb-8 gap-4 sm:gap-6 px-1">
        {/* Top Right Actions (Theme + Profile) - Visible only on md+ since mobile has top nav */}
        <div className="hidden md:flex justify-end w-full">
          <div className="flex items-center gap-3">
            <div className="flex bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-full p-1 gap-1">
              {(theme.startsWith("cyber") || theme === "hero-miles") && (
                <div className="flex items-center gap-1.5 px-2 border-r border-slate-200 dark:border-slate-700 mr-1">
                  {[
                    {
                      id: theme.includes("-light") ? "cyber-light" : "cyber",
                      bg: "bg-[#0ea5e9]",
                    },
                    { id: theme.includes("-light") ? "cyber-green-light" : "cyber-green", bg: "bg-[#22c55e]" },
                    { id: theme.includes("-light") ? "cyber-lavender-light" : "cyber-lavender", bg: "bg-[#a855f7]" },
                    { id: theme.includes("-light") ? "cyber-pink-light" : "cyber-pink", bg: "bg-[#ec4899]" },
                    { id: theme.includes("-light") ? "cyber-orange-light" : "cyber-orange", bg: "bg-[#f97316]" },
{ id: "hero-miles", bg: "bg-gradient-to-br from-[#ea3323] via-[#ea3323] to-black" },
                  ].map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setTheme(color.id as any)}
                      className={`w-4 h-4 rounded-full flex items-center justify-center overflow-hidden relative ${color.bg} ${theme === color.id ? "ring-2 ring-offset-1 ring-indigo-500 dark:ring-indigo-400 dark:ring-offset-slate-900 border border-white" : "opacity-60 hover:opacity-100 hover:scale-110 transition-all"}`}
                      title={"Select " + color.id.split('-').join(' ') + " color"}
                    >
                      {color.id === "hero-miles" && (
                        <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] absolute opacity-50 pointer-events-none stroke-white" style={{ fill: 'none', strokeWidth: 1 }}>
                          <path d="M12 0v24M0 12h24M3 3l18 18M3 21L21 3" />
                          <circle cx="12" cy="12" r="4" />
                          <circle cx="12" cy="12" r="8" />
                          <circle cx="12" cy="12" r="12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  if ((theme.startsWith("cyber") || theme === "hero-miles")) {
                    setTheme(theme.includes("-light") ? "light" : "dark");
                  } else {
                    setTheme(theme === "light" ? "cyber-light" : "cyber");
                  }
                }}
                className={`p-2 rounded-full transition-colors flex ${
                  (theme.startsWith("cyber") || theme === "hero-miles")
                    ? "text-indigo-600 bg-indigo-50/80 dark:text-indigo-400 dark:bg-indigo-900/40"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                }`}
                title={
                  (theme.startsWith("cyber") || theme === "hero-miles")
                    ? "Exit Gamer Mode"
                    : "Enter Gamer Mode"
                }
              >
                <Gamepad2 className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  if (theme.startsWith("cyber") || theme === "hero-miles") {
      if (theme === "hero-miles") {
        setTheme("light"); // Fallback since hero-miles has no light mode
      } else if (theme.includes("-light")) {
        setTheme(theme.replace("-light", "") as any);
      } else {
        setTheme((theme === "cyber" ? "cyber-light" : theme + "-light") as any);
      }
    } else {
                    setTheme(theme === "light" ? "dark" : "light");
                  }
                }}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors flex"
                title="Toggle Theme"
              >
                {theme === "dark" || ((theme.startsWith("cyber") || theme === "hero-miles") && !theme.includes("-light")) ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {user && (
              <button
                className="flex items-center justify-center cursor-pointer hover:ring-2 ring-indigo-500/50 hover:shadow-md transition-all rounded-full bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/50 overflow-hidden shrink-0"
                onClick={() => {
                  setActiveTab("profile");
                  window.scrollTo(0, 0);
                }}
              >
                <img
                  src={
                    profile?.photoURL ||
                    user.photoURL ||
                    `https://ui-avatars.com/api/?name=${user.displayName}`
                  }
                  alt="Profile"
                  className="w-10 h-10 object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            )}
          </div>
        </div>

        <div>
           <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 font-semibold flex items-center gap-2">
             <Calendar className="w-3.5 h-3.5" />
             {formattedDate}
           </div>
           <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
             <span className="theme-greeting-text">{greeting},</span> <span className="text-indigo-600 dark:text-indigo-400">{profile?.displayName?.split(' ')[0] || user?.displayName?.split(' ')[0] || 'User'}</span>!
           </h1>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
         {/* Quote */}
         <div 
           ref={quoteContainerRef}
           onClick={() => {
             if (canEditQuotes && !quoteControlsVisible) {
               setQuoteControlsVisible(true);
               setManualQuoteIdx(activeQuote.index);
             }
           }}
           className={`lg:col-span-3 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/90 border border-slate-200 dark:border-slate-800/80 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-center items-center text-center shadow-sm relative overflow-hidden group ${canEditQuotes ? 'cursor-pointer' : ''}`}
         >
             {/* decorative blobs */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none rounded-[2rem]">
                <div className={`absolute -top-32 -right-32 w-[300px] h-[300px] rounded-full blur-[64px] transition-colors duration-700 ${quoteControlsVisible ? 'bg-indigo-500/20' : 'bg-indigo-500/10 dark:bg-indigo-500/5 group-hover:bg-indigo-500/20'}`}></div>
                <div className={`absolute -bottom-32 -left-32 w-[300px] h-[300px] rounded-full blur-[64px] transition-colors duration-700 ${quoteControlsVisible ? 'bg-purple-500/20' : 'bg-purple-500/10 dark:bg-purple-500/5 group-hover:bg-purple-500/20'}`}></div>
             </div>

             {/* Admin Controls */}
             {canEditQuotes && quoteControlsVisible && (
               <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-1.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                 <button
                   onClick={(e) => { e.stopPropagation(); handlePrevQuote(); }}
                   className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
                   title="Previous Quote"
                 >
                   <ChevronLeft className="w-4 h-4" />
                 </button>
                 <button
                   onClick={(e) => { e.stopPropagation(); handleNextQuote(); }}
                   className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors"
                   title="Next Quote"
                 >
                   <ChevronRight className="w-4 h-4" />
                 </button>
                 <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                 <button
                   onClick={(e) => { e.stopPropagation(); handleSaveQuote(); }}
                   disabled={isSavingQuote || manualQuoteIdx === null}
                   className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full transition-colors disabled:opacity-50"
                   title="Save as Current Quote"
                 >
                   <Save className="w-3.5 h-3.5" />
                 </button>
               </div>
             )}
             
             <h3 className="theme-quote-text text-lg sm:text-2xl md:text-3xl font-serif italic text-slate-800 dark:text-slate-200 mb-6 z-10 leading-relaxed px-4 transition-opacity duration-300">
                "{activeQuote.text}"
             </h3>
             {activeQuote.author && (
               <div className="text-[9px] sm:text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-3 sm:gap-6 z-10">
                  <div className="h-px w-10 sm:w-16 bg-slate-300 dark:bg-slate-700"></div>
                  {activeQuote.author.toUpperCase()}
                  <div className="h-px w-10 sm:w-16 bg-slate-300 dark:bg-slate-700"></div>
               </div>
             )}
         </div>

         {/* Activity Map / Tracking - spans full width */}
         <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-[2rem] p-6 sm:p-10 shadow-sm relative group">
             <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]"></div>
             </div>

             <div className="relative z-10 w-full">
               <ActivityMap />
             </div>
         </div>

      </div>
    </div>
  );
}
