import React from 'react';
import { Trash2, RefreshCw, Globe, Lock } from 'lucide-react';
import { UpdateItem, VersionRelease } from '../../config/versionConfig';
import { getChangelogIcon } from './changelogThemeStyles';

interface ChangelogFeatureGroupSectionProps {
  groupKey: 'A' | 'B';
  sectionTitle: string;
  items: UpdateItem[];
  isEditMode: boolean;
  onUpdateGroupTitle: (group: 'A' | 'B', title: string) => void;
  onAddItem: (group: 'A' | 'B', iconName: any) => void;
  onDeleteItem: (group: 'A' | 'B', index: number) => void;
  onUpdateCardField: (group: 'A' | 'B', index: number, field: keyof UpdateItem, val: string) => void;
}

export function ChangelogFeatureGroupSection({
  groupKey,
  sectionTitle,
  items,
  isEditMode,
  onUpdateGroupTitle,
  onAddItem,
  onDeleteItem,
  onUpdateCardField,
}: ChangelogFeatureGroupSectionProps) {
  if (!isEditMode && items.length === 0) return null;

  const isGroupA = groupKey === 'A';
  const textColorClass = isGroupA
    ? 'text-indigo-600 dark:text-indigo-400'
    : 'text-emerald-600 dark:text-emerald-400';
  const dotColorClass = isGroupA
    ? 'bg-indigo-500 dark:bg-indigo-400'
    : 'bg-emerald-500 dark:bg-emerald-400';
  const placeholderText = isGroupA ? 'Group A Header' : 'Group B Header';

  return (
    <div>
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-900 pb-1.5">
        {isEditMode ? (
          <input
            autoComplete="new-password"
            list="autocompleteOff"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            type="text"
            className={`w-full text-xs font-semibold uppercase tracking-wider ${textColorClass} bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none py-0.5`}
            value={sectionTitle}
            onChange={(e) => onUpdateGroupTitle(groupKey, e.target.value)}
            placeholder={placeholderText}
          />
        ) : (
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${textColorClass} flex items-center gap-2`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotColorClass}`} />
            {sectionTitle}
          </h3>
        )}
      </div>

      {/* Add icon dock for Admin Mode */}
      {isEditMode && (
        <div className="flex items-center gap-2 mb-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 p-2 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Insert Card with Icon:</span>
          {['brain', 'palette', 'sliders', 'chart', 'sparkles', 'grid', 'zap'].map((ico) => (
            <button
              key={ico}
              onClick={() => onAddItem(groupKey, ico)}
              type="button"
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
              title={`Add card with ${ico} icon`}
            >
              {getChangelogIcon(ico)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, id) => (
          <div
            key={id}
            className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-800 transition-colors group relative items-start"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-inner">
              {getChangelogIcon(item.iconName)}
            </div>

            {isEditMode ? (
              <div className="flex-1 space-y-1.5">
                <input
                  autoComplete="new-password"
                  list="autocompleteOff"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  type="text"
                  className="w-full text-sm font-semibold border-b border-dashed border-slate-300 dark:border-slate-750 hover:border-slate-400 dark:hover:border-slate-600 bg-transparent py-0.5 focus:border-indigo-500 focus:outline-none text-slate-800 dark:text-slate-100"
                  value={item.title}
                  onChange={(e) => onUpdateCardField(groupKey, id, 'title', e.target.value)}
                  placeholder="New Feature / Update Card"
                />
                <textarea
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  className="w-full text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent rounded p-1.5 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
                  rows={2}
                  value={item.desc}
                  onChange={(e) => onUpdateCardField(groupKey, id, 'desc', e.target.value)}
                  placeholder="Double-click to edit feature title and descriptions."
                />
              </div>
            ) : (
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-0.5">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            )}

            {isEditMode && (
              <button
                onClick={() => onDeleteItem(groupKey, id)}
                type="button"
                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-red-500 rounded-lg transition-colors ml-2 shrink-0 self-center"
                title="Remove card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {isEditMode && items.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">
            No items listed in this cluster. Toggle Edit mode to insert nodes.
          </p>
        )}
      </div>
    </div>
  );
}

interface ChangelogAdminFooterProps {
  activeChangelogData: VersionRelease;
  allVersions: VersionRelease[];
  latestCloudVersion: string;
  isOwner: boolean;
  isPublishing: boolean;
  deleteConfirmId: string | null;
  setDeleteConfirmId: React.Dispatch<React.SetStateAction<string | null>>;
  onPublish: () => void;
  onDeleteVersion: (versionId: string) => void;
}

export function ChangelogAdminFooter({
  activeChangelogData,
  allVersions,
  latestCloudVersion,
  isOwner,
  isPublishing,
  deleteConfirmId,
  setDeleteConfirmId,
  onPublish,
  onDeleteVersion,
}: ChangelogAdminFooterProps) {
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onPublish}
        disabled={isPublishing}
        className="w-full max-w-sm py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 border border-emerald-500/20 focus:outline-none disabled:opacity-50"
      >
        {isPublishing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Publishing Build Logs...
          </>
        ) : (
          <>
            <Globe className="w-4 h-4 animate-pulse" />
            {allVersions.some(
              (v) =>
                v.version.toLowerCase() === activeChangelogData?.version.toLowerCase() &&
                activeChangelogData.version.toLowerCase() !== latestCloudVersion.toLowerCase()
            )
              ? 'Update Historical Draft'
              : 'Publish Update to All Users'}
          </>
        )}
      </button>
      {isOwner &&
        allVersions.some((v) => v.version.toLowerCase() === activeChangelogData?.version.toLowerCase()) && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (deleteConfirmId === activeChangelogData.version) {
                onDeleteVersion(activeChangelogData.version);
                setDeleteConfirmId(null);
              } else {
                setDeleteConfirmId(activeChangelogData.version);
                setTimeout(() => setDeleteConfirmId(null), 3000);
              }
            }}
            disabled={isPublishing}
            className={`w-full max-w-sm py-2 px-6 mt-1.5 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border focus:outline-none transition-colors disabled:opacity-50 relative z-50 pointer-events-auto ${
              deleteConfirmId === activeChangelogData.version
                ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600 animate-pulse'
                : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 border-rose-500/20'
            }`}
          >
            <Trash2 className="w-3 h-3" />
            {deleteConfirmId === activeChangelogData.version
              ? 'Click to Confirm Deletion'
              : 'Delete Published Version'}
          </button>
        )}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 mt-2">
        <Lock className="w-3 h-3 text-emerald-500" />
        Only authenticated owners can commit update nodes. Rules validated.
      </div>
    </div>
  );
}
