import React, { useState, useRef, useEffect } from "react";
import { Plus, Star } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useVocabularyStore } from "../../../store/vocabularyStore";

interface EditorialNodeRendererProps {
  title: string;
  type: "phrasalVerbs" | "idioms" | "oneWordSubs";
  icon: React.ReactNode;
  items: any[];
  canvasId: string;
  canManageLearning: boolean;
  addTextEntry: (canvasId: string, type: any, entry: any) => void;
  updateTextEntry: (canvasId: string, type: any, id: string, entry: any) => void;
  deleteTextEntry: (canvasId: string, type: any, id: string) => void;
  activeDeleteId: string | null;
  setActiveDeleteId: (id: string | null) => void;
}

export function EditorialNodeRenderer({
  title,
  type,
  icon,
  items,
  canvasId,
  canManageLearning,
  addTextEntry,
  updateTextEntry,
  deleteTextEntry,
  activeDeleteId,
  setActiveDeleteId,
}: EditorialNodeRendererProps) {
  const favoriteVocabIds = useVocabularyStore((state) => state.favoriteVocabIds);
  const toggleFavorite = useVocabularyStore((state) => state.toggleFavorite);

  const [toastId, setToastId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const willBeStarred = !favoriteVocabIds.includes(id);
    toggleFavorite(id);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastId(id);
    setToastMessage(willBeStarred ? "Added to Favorites" : "Removed from Favorites");
    toastTimeoutRef.current = setTimeout(() => {
      setToastId(null);
      setToastMessage(null);
    }, 2000);
  };
  const getStyleForType = (type: string) => {
    switch (type) {
      case "phrasalVerbs":
        return "bg-[#f0f5ff] dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30 focus-within:border-blue-300 dark:focus-within:border-blue-500/50";
      case "idioms":
        return "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30 focus-within:border-amber-300 dark:focus-within:border-amber-500/50";
      case "oneWordSubs":
        return "bg-[#f6f0ff] dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30 focus-within:border-purple-300 dark:focus-within:border-purple-500/50";
      default:
        return "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50";
    }
  };

  const styleClasses = getStyleForType(type);

  return (
    <div className="flex flex-col gap-3 py-6 first:pt-2 last:pb-2 border-b last:border-0 border-slate-200 dark:border-slate-800">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          {icon} {title}
        </h3>
        {canManageLearning && (
          <button
            onClick={() =>
              addTextEntry(canvasId, type, { text: "", meaning: "" })
            }
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title={`Add new ${title.toLowerCase()}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const hasEmbeddedExample =
            type !== "idioms" &&
            !item.example &&
            typeof item.meaning === "string" &&
            item.meaning.match(/Example:\s*(.*)/i);
          const displayMeaning = hasEmbeddedExample
            ? item.meaning.replace(/Example:\s*(.*)/i, "").trim()
            : (typeof item.meaning === "string" ? item.meaning.trim() : item.meaning);
          const displayExample =
            typeof (item.example || (hasEmbeddedExample ? hasEmbeddedExample[1] : "")) === "string"
              ? (item.example || (hasEmbeddedExample ? hasEmbeddedExample[1] : "")).trim()
              : (item.example || (hasEmbeddedExample ? hasEmbeddedExample[1] : ""));

          const isStarred = favoriteVocabIds.includes(item.id);

          return (
            <div
              key={item.id}
              data-item-id={item.id}
              onClick={() => setActiveDeleteId(item.id)}
              className={`relative flex flex-col gap-1 p-3.5 border rounded-lg group transition-colors ${styleClasses}`}
            >
              {/* Item Actions (Star & Delete) */}
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                {toastId === item.id && toastMessage && (
                  <div className="px-2.5 py-0.5 bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-[11px] font-semibold rounded-full shadow-md whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-right-2 duration-200">
                    {toastMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => handleToggleStar(item.id, e)}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                    isStarred
                      ? "text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                      : "text-slate-400 hover:text-amber-500 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                  }`}
                  title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star
                    className={`w-4 h-4 transition-transform active:scale-125 ${
                      isStarred ? "fill-amber-400 text-amber-500" : ""
                    }`}
                  />
                </button>

                {canManageLearning && activeDeleteId === item.id && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteTextEntry(canvasId, type, item.id);
                    }}
                    className="p-1 px-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm animate-in fade-in zoom-in"
                    title="Delete Entry"
                  >
                    Delete
                  </button>
                )}
              </div>

              <TextareaAutosize
                placeholder="Term/Phrase"
                value={item.text}
                onChange={(e) =>
                  updateTextEntry(canvasId, type, item.id, {
                    text: e.target.value,
                  })
                }
                readOnly={!canManageLearning}
                className={`font-semibold text-base bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full pr-16 resize-none ${
                  type === "phrasalVerbs"
                    ? "!text-[#4883ff]"
                    : type === "idioms"
                      ? "!text-amber-600 dark:!text-amber-400"
                      : type === "oneWordSubs"
                        ? "!text-[#b75afa] dark:!text-purple-400"
                        : "!text-slate-800 dark:!text-slate-100"
                }`}
              />
              <TextareaAutosize
                placeholder="Meaning"
                value={displayMeaning}
                onChange={(e) =>
                  updateTextEntry(canvasId, type, item.id, {
                    meaning: e.target.value,
                    ...(hasEmbeddedExample ? { example: displayExample } : {}),
                  })
                }
                readOnly={!canManageLearning}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full whitespace-pre-wrap break-words resize-none"
              />
              {type !== "idioms" && (displayExample || canManageLearning) && (
                <>
                  <div className="h-px w-full bg-slate-200 dark:bg-slate-800/80 my-0.5" />
                  <TextareaAutosize
                    placeholder="Example (optional)"
                    value={displayExample}
                    onChange={(e) => {
                      if (hasEmbeddedExample) {
                        updateTextEntry(canvasId, type, item.id, {
                          meaning: displayMeaning,
                          example: e.target.value,
                        });
                      } else {
                        updateTextEntry(canvasId, type, item.id, {
                          example: e.target.value,
                        });
                      }
                    }}
                    readOnly={!canManageLearning}
                    className="text-sm text-slate-500 dark:text-slate-400 bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 w-full italic whitespace-pre-wrap break-words resize-none"
                  />
                </>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2 pl-1">
            No entries. {canManageLearning ? "Click '+' to add one." : ""}
          </div>
        )}
      </div>
    </div>
  );
}
