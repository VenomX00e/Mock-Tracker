import React, { useContext, useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Type,
  Activity,
  Lightbulb,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { AppStateCtx } from "../../context/AppContext";
import { useVocabularyStore } from "../../store/vocabularyStore";
import { extractContentFromDocument } from "../../services/aiService";
import { extractPdfPages } from "../../utils/pdfUtils";
import { EditorialSidebar } from "./editorial/EditorialSidebar";
import { EditorialNodeRenderer } from "./editorial/EditorialNodeRenderer";

interface EditorialCanvasViewProps {
  canvasId: string;
  onBack: () => void;
}

import { getActiveApiKey } from '../../utils/apiKeyManager';

export function EditorialCanvasView({
  canvasId,
  onBack,
}: EditorialCanvasViewProps) {
  const { isOwner, adminPermissions } = useContext(AppStateCtx)!;
  const canManageLearning = isOwner || adminPermissions?.canManageLearning;

  const {
    canvases,
    addTextEntry,
    updateTextEntry,
    deleteTextEntry,
    addVocab,
    updateVocab,
    deleteVocab,
    updateCanvas,
  } = useVocabularyStore();
  const canvas = canvases.find((c) => c.id === canvasId);

  const [isExtractPopoverOpen, setIsExtractPopoverOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingTextData, setPendingTextData] = useState<string | null>(null);
  const [pageRange, setPageRange] = useState("All pages selected");

  const extractPopoverRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDragging = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    let frameId: number;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      
      // Use requestAnimationFrame to throttle DOM updates
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const isDesktop = window.matchMedia("(min-width: 768px)").matches;
        const rect = containerRef.current.getBoundingClientRect();

        let newPercent;
        if (isDesktop) {
          const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
          newPercent = ((clientX - rect.left) / rect.width) * 100;
        } else {
          const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
          newPercent = ((clientY - rect.top) / rect.height) * 100;
        }

        const newWidth = Math.max(20, Math.min(80, newPercent));
        containerRef.current.style.setProperty('--left-width', `${newWidth}%`);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      cancelAnimationFrame(frameId);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
      cancelAnimationFrame(frameId);
    };
  }, [isDragging]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        extractPopoverRef.current &&
        !extractPopoverRef.current.contains(event.target as Node)
      ) {
        setIsExtractPopoverOpen(false);
      }
    }
    if (isExtractPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExtractPopoverOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (!getActiveApiKey()) {
      alert(
        "Please configure your Gemini API Key in the AI Settings (top right on Learning page).",
      );
      if (e.target) e.target.value = "";
      return;
    }

    setPendingFiles(files);
    setPageRange("All pages selected");
    setIsExtractPopoverOpen(false);
    if (e.target) e.target.value = "";
  };

  const handleConfirmExtraction = async () => {
    if (!pendingFiles.length && pendingTextData === null) return;
    const files = [...pendingFiles];
    let textData = pendingTextData !== null ? pendingTextData.trim() : null;

    if (textData === "") {
      textData = null;
      setPendingTextData(null);
      if (!files.length) return;
    }

    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
    
    try {
      setIsExtracting(true);
      setPendingFiles([]);
      setPendingTextData(null);

      const documents: { base64Data: string, mimeType: string }[] = [];

      if (textData === null) {
        for (const file of files) {
          let base64Data = "";
          if (
            file.type === "application/pdf" &&
            pageRange &&
            pageRange !== "All pages selected"
          ) {
            const arrayBuffer = await file.arrayBuffer();
            base64Data = await extractPdfPages(arrayBuffer, pageRange);

            // Final size check for trimmed PDF (~ base64 length * 0.75)
            const approxSize = base64Data.length * 0.75;
            if (approxSize > MAX_FILE_SIZE) {
              throw new Error(
                "The selected pages are still too large (over 4MB). Please select fewer pages.",
              );
            }
          } else {
            if (file.type === "application/pdf" && file.size > MAX_FILE_SIZE) {
              throw new Error(
                "This PDF is too large (over 4MB). It may exceed the AI token limits. Please try a smaller file or extract specific pages.",
              );
            }

            const reader = new FileReader();
            base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => {
                const result = reader.result as string;
                const b64 = result.split(",")[1];
                resolve(b64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }
          documents.push({ base64Data, mimeType: file.type });
        }
      }

      const response = await extractContentFromDocument(
        textData !== null ? null : documents, 
        undefined, 
        textData || undefined
      );

      if (response.vocabulary) {
        response.vocabulary.forEach((v) => {
          addVocab(canvasId, {
            word: v.word || "",
            meaning: v.meaning || "",
            mnemonic: v.mnemonic || "",
            synonyms: v.synonyms || [],
            antonyms: v.antonyms || [],
            example: v.example || "",
            pos: v.pos || "",
            additional: v.additional || "",
          });
        });
      }

      if (response.idioms) {
        response.idioms.forEach((i) => {
          addTextEntry(canvasId, "idioms", {
            text: i.text || "",
            meaning: i.meaning || "",
            example: i.example || "",
          });
        });
      }

      if (response.phrasalVerbs) {
        response.phrasalVerbs.forEach((i) => {
          addTextEntry(canvasId, "phrasalVerbs", {
            text: i.text || "",
            meaning: i.meaning || "",
            example: i.example || "",
          });
        });
      }

      if (response.oneWordSubstitutions) {
        response.oneWordSubstitutions.forEach((i) => {
          addTextEntry(canvasId, "oneWordSubs", {
            text: i.text || "",
            meaning: i.meaning || "",
            example: i.example || "",
          });
        });
      }
    } catch (err: any) {
      alert(err.message || "Failed to extract content");
    } finally {
      setIsExtracting(false);
    }
  };

  if (!canvas) {
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium border border-transparent"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Hub
        </button>
        <div>Canvas not found.</div>
      </div>
    );
  }

  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // If the click is inside a tile with a data-item-id attribute, we let its onClick handle it.
      // Otherwise, we clear the activeDeleteId.
      const target = e.target as HTMLElement;
      if (!target.closest("[data-item-id]")) {
        setActiveDeleteId(null);
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0f172a] relative rounded-xl xl:rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {isExtracting && (
        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-800 dark:text-slate-200 font-medium text-lg">
            Extracting vocabulary...
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            This may take a few seconds.
          </p>
        </div>
      )}

      {/* Hidden file inputs */}
      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        autoCorrect="off" spellCheck={false}     />
      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
        type="file"
        ref={pdfInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleFileChange}
        autoCorrect="off" spellCheck={false}     />

      {/* Header */}
      <div className="flex items-center gap-3 md:gap-4 px-3 md:px-6 py-3 md:py-4 bg-white dark:bg-[#1E1F25] border-b border-slate-200 dark:border-slate-800 flex-none sticky top-0 z-40 shadow-sm relative">
        <button
          onClick={onBack}
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          {canManageLearning ? (
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="text"
              value={canvas.title}
              onChange={(e) => updateCanvas(canvasId, { title: e.target.value })}
              className="text-lg md:text-xl font-bold text-slate-800 dark:text-white leading-none tracking-tight bg-transparent border-none outline-none focus:ring-0 p-0 block w-full placeholder:text-slate-400"
              placeholder="Canvas Title"
            />
          ) : (
            <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white leading-none tracking-tight">
              {canvas.title}
            </h2>
          )}
          <span className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 inline-block uppercase tracking-wider">
            Editorial Canvas
          </span>
        </div>

        {canManageLearning && (
          <div className="relative" ref={extractPopoverRef}>
            <button
              onClick={() => setIsExtractPopoverOpen(!isExtractPopoverOpen)}
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors border border-slate-200 dark:border-slate-700"
              title="Extract Content from Document"
            >
              <Paperclip className="w-4 h-4 text-indigo-500" />
            </button>
            {(isExtractPopoverOpen || pendingFiles.length > 0 || pendingTextData !== null) && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95">
                {pendingFiles.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {pendingFiles.length === 1 && pendingFiles[0].type === "application/pdf" ? (
                          <FileText className="w-4 h-4 text-red-500" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-emerald-500" />
                        )}
                        <span
                          className="truncate max-w-[180px]"
                          title={pendingFiles.length === 1 ? pendingFiles[0].name : `${pendingFiles.length} files selected`}
                        >
                          {pendingFiles.length === 1 ? pendingFiles[0].name : `${pendingFiles.length} item${pendingFiles.length > 1 ? 's' : ''} selected`}
                        </span>
                      </h3>
                      <button
                        onClick={() => setPendingFiles([])}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {pendingFiles.length === 1 && pendingFiles[0].type === "application/pdf" && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Extract Pages (e.g. 1-3, 5)
                        </label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                          type="text"
                          value={
                            pageRange === "All pages selected" ? "" : pageRange
                          }
                          onChange={(e) =>
                            setPageRange(e.target.value || "All pages selected")
                          }
                          placeholder="All pages selected"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingFiles([])}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmExtraction}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors mb-0"
                      >
                        Extract
                      </button>
                    </div>
                  </>
                ) : pendingTextData !== null ? (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Type className="w-4 h-4 text-blue-500" />
                        <span>Extract from Text</span>
                      </h3>
                      <button
                        onClick={() => setPendingTextData(null)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mb-3">
                      <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                        value={pendingTextData}
                        onChange={(e) => setPendingTextData(e.target.value)}
                        placeholder="Paste vocabulary text here..."
                        rows={6}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingTextData(null)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmExtraction}
                        disabled={!pendingTextData.trim()}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors mb-0"
                      >
                        Extract
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        if (!getActiveApiKey()) {
                          alert("Please configure your Gemini API Key in the AI Settings.");
                          return;
                        }
                        setPendingFiles([]);
                        setPendingTextData("");
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                    >
                      <Type className="w-4 h-4 text-blue-500" /> Extract from
                      Text
                    </button>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-500" /> Extract
                      from Image
                    </button>
                    <button
                      onClick={() => pdfInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-left"
                    >
                      <FileText className="w-4 h-4 text-red-500" /> Extract from
                      PDF
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Split */}
      <div
        ref={containerRef}
        className="flex flex-1 overflow-hidden flex-col md:flex-row"
        style={{
          cursor: isDragging ? "col-resize" : "default",
          userSelect: isDragging ? "none" : "auto",
          "--left-width": "60%",
        } as React.CSSProperties}
      >
        {/* Left Column: Vocabularies */}
        <EditorialSidebar
          canvasId={canvasId}
          vocabularies={canvas.vocabularies}
          canManageLearning={canManageLearning}
          addVocab={addVocab}
          updateVocab={updateVocab}
          deleteVocab={deleteVocab}
        />

        {/* Resizable Vertical/Horizontal Divider */}
        <div
          className="group relative flex items-center justify-center w-full h-2 md:w-2 md:h-full flex-none cursor-row-resize md:cursor-col-resize touch-none z-10 -my-0.5 md:-my-0 md:-mx-0.5 bg-transparent"
          onMouseDown={startDragging}
          onTouchStart={startDragging}
        >
          <div className="w-full h-px md:w-px md:h-full bg-slate-200 dark:bg-slate-800 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors" />
        </div>

        {/* Right Column: Extras */}
        <div className="flex-1 overflow-y-auto py-3 md:py-6 px-[15px] bg-white dark:bg-[#1E1F25]/30 scrollbar-thin">
          <div className="flex flex-col">
            <EditorialNodeRenderer
              title="Phrasal Verbs"
              type="phrasalVerbs"
              icon={<Activity className="w-4 h-4 text-blue-500" />}
              items={canvas.phrasalVerbs || []}
              canvasId={canvasId}
              canManageLearning={canManageLearning}
              addTextEntry={addTextEntry}
              updateTextEntry={updateTextEntry}
              deleteTextEntry={deleteTextEntry}
              activeDeleteId={activeDeleteId}
              setActiveDeleteId={setActiveDeleteId}
            />
            <EditorialNodeRenderer
              title="Idioms & Phrases"
              type="idioms"
              icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
              items={canvas.idioms || []}
              canvasId={canvasId}
              canManageLearning={canManageLearning}
              addTextEntry={addTextEntry}
              updateTextEntry={updateTextEntry}
              deleteTextEntry={deleteTextEntry}
              activeDeleteId={activeDeleteId}
              setActiveDeleteId={setActiveDeleteId}
            />
            <EditorialNodeRenderer
              title="One Word Substitutions"
              type="oneWordSubs"
              icon={<Type className="w-4 h-4 text-purple-500" />}
              items={canvas.oneWordSubs || []}
              canvasId={canvasId}
              canManageLearning={canManageLearning}
              addTextEntry={addTextEntry}
              updateTextEntry={updateTextEntry}
              deleteTextEntry={deleteTextEntry}
              activeDeleteId={activeDeleteId}
              setActiveDeleteId={setActiveDeleteId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
