import React from 'react';
import {
  Youtube,
  Loader2,
  FileText,
  ArrowRight,
  Image as ImageIcon,
  Type,
} from 'lucide-react';
import { ExtractionSourceType, ExtractionSourceMetadata } from '../../../types/extraction';

interface ExtractionStep1SourceProps {
  sourceType: ExtractionSourceType;
  setSourceType: (type: ExtractionSourceType) => void;
  setErrorMessage: (msg: string | null) => void;
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  useCustomRange: boolean;
  setUseCustomRange: (val: boolean) => void;
  startTimeStr: string;
  setStartTimeStr: (val: string) => void;
  endTimeStr: string;
  setEndTimeStr: (val: string) => void;
  isLoading: boolean;
  loadingMessage: string;
  handleFetchYouTubeTranscript: (e?: React.FormEvent) => void;
  setSourceMetadata: (meta: ExtractionSourceMetadata) => void;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedFile: File | null;
  pageRange: string;
  setPageRange: (val: string) => void;
  handleProcessDocumentFile: () => void;
  imagePreviewUrl: string | null;
  rawText: string;
  setRawText: (val: string) => void;
  handleProceedWithRawText: () => void;
}

export function ExtractionStep1Source({
  sourceType,
  setSourceType,
  setErrorMessage,
  youtubeUrl,
  setYoutubeUrl,
  useCustomRange,
  setUseCustomRange,
  startTimeStr,
  setStartTimeStr,
  endTimeStr,
  setEndTimeStr,
  isLoading,
  loadingMessage,
  handleFetchYouTubeTranscript,
  setSourceMetadata,
  setCurrentStep,
  fileInputRef,
  handleFileInputChange,
  selectedFile,
  pageRange,
  setPageRange,
  handleProcessDocumentFile,
  imagePreviewUrl,
  rawText,
  setRawText,
  handleProceedWithRawText,
}: ExtractionStep1SourceProps) {
  return (
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
  );
}
