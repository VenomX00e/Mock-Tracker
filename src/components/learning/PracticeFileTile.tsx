import React from 'react';
import { PracticeFile } from '../../types';
import { FileText, Link as LinkIcon, Download, Eye, ExternalLink, Image as ImageIcon, Code, Archive, CheckCircle2, Circle } from 'lucide-react';
import { create } from 'zustand';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useFileDownloader } from '../../hooks/useFileDownloader';

// Simple store for caching downloaded blob URLs
interface FileCacheStore {
  blobUrls: Record<string, string>;
  setBlobUrl: (fileId: string, url: string) => void;
}
export const useFileCacheStore = create<FileCacheStore>((set) => ({
  blobUrls: {},
  setBlobUrl: (fileId, url) => set((state) => ({ blobUrls: { ...state.blobUrls, [fileId]: url } })),
}));

// Utility to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function PracticeFileTile({ file }: { file: PracticeFile }) {
  const { blobUrls, setBlobUrl } = useFileCacheStore();
  const cachedUrl = blobUrls[file.id];
  
  const { profile, togglePracticeFileCompletion } = useUserProfile();
  const isCompleted = profile?.completedPracticeFiles?.includes(file.id);

  const { downloadState, progress, downloadFile } = useFileDownloader(
    file.id,
    file.fileMeta,
    cachedUrl,
    setBlobUrl
  );

  const isExternal = file.type === 'external_link';

  const handleAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExternal) {
      let formattedUrl = file.fileMeta.url;
      if (formattedUrl && !formattedUrl.startsWith('http')) {
        formattedUrl = `https://${formattedUrl}`;
      }
      window.open(formattedUrl, '_blank');
      return;
    }

    if (downloadState === 'READY') {
      window.open(cachedUrl || file.fileMeta.url, '_blank');
      return;
    }

    if (downloadState === 'IDLE') {
      await downloadFile();
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (isExternal) return <LinkIcon className="w-6 h-6" />;
    if (!mimeType) return <FileText className="w-6 h-6" />;
    
    const lower = mimeType.toLowerCase();
    if (lower.includes('image')) return <ImageIcon className="w-6 h-6" />;
    if (lower.includes('html') || lower.includes('csv')) return <Code className="w-6 h-6" />;
    if (lower.includes('zip') || lower.includes('tar') || lower.includes('rar')) return <Archive className="w-6 h-6" />;
    
    return <FileText className="w-6 h-6" />;
  };

  const getDifficultyStyles = (level: string) => {
    switch(level) {
      case 'Easy': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
      case 'Moderate': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
      case 'Hard': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all group gap-4 relative overflow-hidden">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (togglePracticeFileCompletion) togglePracticeFileCompletion(file.id);
        }}
        className="absolute top-2 left-2 z-10 p-0.5 rounded-full transition-all duration-200 bg-transparent focus:outline-none"
        title={isCompleted ? "Mark as uncompleted" : "Mark as completed"}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 hover:text-emerald-600 transition-colors" />
        ) : (
          <Circle className="w-5 h-5 text-slate-200 hover:text-slate-400 dark:text-slate-700 dark:hover:text-slate-500 transition-all" />
        )}
      </button>

      {file.difficulty && (
        <div className={`absolute top-0 right-0 rounded-bl-xl rounded-tr-2xl px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getDifficultyStyles(file.difficulty)}`}>
          {file.difficulty}
        </div>
      )}

      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${isExternal ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'}`}>
        {getFileIcon(file.fileMeta.mimeType)}
      </div>

      {/* Info Column */}
      <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm line-clamp-2 leading-tight mb-1">
          {file.name}
        </h4>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-medium text-slate-500">
            {isExternal ? 'External Link' : (file.fileMeta.sizeBytes ? formatBytes(file.fileMeta.sizeBytes) : 'PDF/Image')}
          </span>
        </div>
        
        {file.attribution && (
          <div className="mt-1 text-[11px] truncate flex items-center">
            <span className="text-slate-400 dark:text-slate-500 mr-1">From</span>
            {file.attribution.channelLink ? (
              <a 
                href={file.attribution.channelLink.startsWith('http') ? file.attribution.channelLink : `https://${file.attribution.channelLink}`} 
                target="_blank" 
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium hover:underline truncate"
              >
                {file.attribution.channelName}
              </a>
            ) : (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate">
                {file.attribution.channelName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Column */}
      <button 
        onClick={handleAction}
        className="shrink-0 cursor-pointer flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 active:scale-95"
        title={isExternal ? "Open Link" : downloadState === 'READY' ? "Open File" : "Download File"}
      >
        {isExternal ? (
          <ExternalLink className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        ) : (
          <>
            {downloadState === 'IDLE' && <Download className="w-5 h-5 text-slate-500 dark:text-slate-400" />}
            {downloadState === 'DOWNLOADING' && (
              <div className="relative w-full h-full flex items-center justify-center p-1.5">
                 <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                        className="text-slate-200 dark:text-slate-800"
                        strokeWidth="4"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                        className="text-indigo-500 dark:text-indigo-400"
                        strokeWidth="4"
                        strokeDasharray={`${progress}, 100`}
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                 </svg>
                 <span className="absolute text-[8px] font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
              </div>
            )}
            {downloadState === 'READY' && <Eye className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />}
          </>
        )}
      </button>
    </div>
  );
}
