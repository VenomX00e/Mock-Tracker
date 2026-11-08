import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Trash2 } from 'lucide-react';
import { VersionRelease } from '../../config/versionConfig';
import { getChangelogIcon } from './changelogThemeStyles';

interface ChangelogHistoryTimelineProps {
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  allVersions: VersionRelease[];
  latestCloudVersion: string;
  isOwner: boolean;
  deleteConfirmId: string | null;
  setDeleteConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
  onEditHistoricalVersion: (historyLog: VersionRelease) => void;
  onDeleteVersion: (versionId: string) => void;
}

export function ChangelogHistoryTimeline({
  showHistory,
  setShowHistory,
  allVersions,
  latestCloudVersion,
  isOwner,
  deleteConfirmId,
  setDeleteConfirmId,
  onEditHistoricalVersion,
  onDeleteVersion,
}: ChangelogHistoryTimelineProps) {
  return (
    <>
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 border-dashed space-y-12">
              {allVersions
                .filter((v) => v.version.toLowerCase() !== latestCloudVersion.toLowerCase())
                .map((historyLog) => (
                  <div key={historyLog.version} className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                        {historyLog.version.toUpperCase()} - {historyLog.title}
                      </h2>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[10px] rounded border border-slate-200 dark:border-slate-700">
                        {historyLog.releaseDate}
                      </span>
                      {isOwner && (
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onEditHistoricalVersion(historyLog);
                            }}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors relative z-50 pointer-events-auto"
                            title="Edit Update"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {deleteConfirmId === historyLog.version && (
                            <span className="text-[10px] text-rose-500 font-medium animate-pulse">
                              Click again to confirm
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (deleteConfirmId === historyLog.version) {
                                onDeleteVersion(historyLog.version);
                                setDeleteConfirmId(null);
                              } else {
                                setDeleteConfirmId(historyLog.version);
                                setTimeout(() => setDeleteConfirmId(null), 3000);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors relative z-50 pointer-events-auto ${
                              deleteConfirmId === historyLog.version
                                ? 'bg-rose-500 text-white shadow-sm hover:bg-rose-600'
                                : 'hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                            }`}
                            title="Delete Update"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Historical Group A */}
                    {historyLog.featuresGroupA && historyLog.featuresGroupA.items.length > 0 && (
                      <div>
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-3 flex items-center gap-2 opacity-80">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                          {historyLog.featuresGroupA.sectionTitle}
                        </h3>
                        <div className="space-y-3">
                          {historyLog.featuresGroupA.items.map((item, id) => (
                            <div
                              key={id}
                              className="flex gap-4 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/40 items-start"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/50 dark:bg-slate-950/50 flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50 shadow-sm opacity-80 scale-90">
                                {getChangelogIcon(item.iconName)}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-0.5">
                                  {item.title}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Historical Group B */}
                    {historyLog.featuresGroupB && historyLog.featuresGroupB.items.length > 0 && (
                      <div>
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 dark:text-emerald-400 mb-3 flex items-center gap-2 opacity-80">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          {historyLog.featuresGroupB.sectionTitle}
                        </h3>
                        <div className="space-y-3">
                          {historyLog.featuresGroupB.items.map((item, id) => (
                            <div
                              key={id}
                              className="flex gap-4 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/40 items-start"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/50 dark:bg-slate-950/50 flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50 shadow-sm opacity-80 scale-90">
                                {getChangelogIcon(item.iconName)}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-0.5">
                                  {item.title}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show History Toggle */}
      <div className="flex justify-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-[13px] font-medium text-[#7d9c6e] hover:text-[#8cb07c] dark:text-[#8aa67d] dark:hover:text-[#9abc8d] transition-colors focus:outline-none flex items-center justify-center"
        >
          {showHistory ? 'Hide previous changes' : 'Show previous changes'}
        </button>
      </div>
    </>
  );
}
