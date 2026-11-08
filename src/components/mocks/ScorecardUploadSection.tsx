import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, Lock, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { AVAILABLE_MOCK_MODELS, formatModelName } from './SubjectRow';

export async function compressScorecardImages(files: File[]): Promise<{ base64: string; mimeType: string }[]> {
  const imagesPayload: { base64: string; mimeType: string }[] = [];

  for (const file of files) {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1600;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            const result = dataUrl.split(',')[1];
            if (result) resolve(result);
            else reject(new Error("Failed to compress image"));
          } else {
            const result = reader.result?.toString().split(',')[1];
            resolve(result || '');
          }
        };
        img.onerror = () => {
          const result = reader.result?.toString().split(',')[1];
          resolve(result || '');
        };
        img.src = reader.result?.toString() || '';
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    imagesPayload.push({ base64: base64Data, mimeType: 'image/jpeg' });
  }

  return imagesPayload;
}

interface ScorecardUploadSectionProps {
  activeModel?: string;
  isModelLocked: boolean;
  isFeatureAllowed: boolean;
  isProcessing: boolean;
  error: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ScorecardUploadSection({
  activeModel,
  isModelLocked,
  isFeatureAllowed,
  isProcessing,
  error,
  fileInputRef,
  onFileChange,
}: ScorecardUploadSectionProps) {
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setIsModelPickerOpen(false);
      }
    };
    if (isModelPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelPickerOpen]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ImageIcon className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">AI Scorecard Upload</h3>
          {activeModel && (
            <div className="relative inline-flex items-center">
              <span className="text-slate-300 dark:text-slate-700 ml-1 mr-1.5">•</span>
              {isModelLocked ? (
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 tracking-normal flex items-center gap-1">
                  <span>{formatModelName(activeModel)}</span>
                  <Lock className="w-2.5 h-2.5 text-slate-400/80 dark:text-slate-500/80" />
                </span>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModelPickerOpen(prev => !prev)}
                    className="text-[11px] font-normal text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 tracking-normal flex items-center gap-1 transition-colors group cursor-pointer"
                    title="Switch model for scorecard extraction"
                  >
                    <span className="underline decoration-dotted decoration-slate-300 dark:decoration-slate-600 underline-offset-2">{formatModelName(activeModel)}</span>
                    <ChevronDown className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                  {isModelPickerOpen && (
                    <div 
                      ref={modelPickerRef}
                      className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 min-w-[170px]"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        Extraction Model
                      </div>
                      <div className="max-h-48 overflow-y-auto py-0.5">
                        {AVAILABLE_MOCK_MODELS.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => {
                              localStorage.setItem('geminiModel_mock_score_extractor', m.value);
                              window.dispatchEvent(new Event('gemini_keys_changed'));
                              setIsModelPickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition-colors ${
                              activeModel === m.value
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{m.label}</span>
                            {activeModel === m.value && <Check className="w-3 h-3 text-indigo-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isFeatureAllowed ? (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm mb-0.5 text-amber-900 dark:text-amber-100">API Key Required</p>
            <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
              An API Key is required for Mock Score Extractor. Please add your Gemini key in Settings or request access from your Administrator.
            </p>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-36 sm:h-40 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-2xl cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 hover:border-indigo-400 transition-all bg-white dark:bg-slate-800/20 group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex flex-col items-center justify-center relative z-10 py-6">
            {isProcessing ? (
              <>
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing scorecard...</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-indigo-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload Image(s)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Multi-select supported (PNG, JPG)</p>
              </>
            )}
          </div>
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"    
            ref={fileInputRef}
            type="file" 
            multiple
            className="hidden" 
            accept="image/*" 
            onChange={onFileChange}
            disabled={isProcessing || !isFeatureAllowed}
            autoCorrect="off" spellCheck={false}     />
        </label>
      )}
      {error && <p className="mt-2.5 text-sm text-red-500 font-medium px-2 flex items-center gap-1.5"><X className="w-4 h-4"/> {error}</p>}
    </section>
  );
}
