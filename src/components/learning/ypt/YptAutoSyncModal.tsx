import React, { useState, useEffect } from 'react';
import { Clock, Zap, Check, AlertCircle, RefreshCw, X, Shield, Play, Pause } from 'lucide-react';
import { getYptSyncInterval, saveYptSyncInterval, triggerContinuousYptSync } from '../../../services/yptService';

interface YptAutoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIntervalChanged?: (newMinutes: number) => void;
}

const PRESET_INTERVALS = [
  { value: 5, label: '5 Mins', desc: 'High frequency' },
  { value: 10, label: '10 Mins', desc: 'Frequent' },
  { value: 15, label: '15 Mins', desc: 'Recommended Default' },
  { value: 30, label: '30 Mins', desc: 'Standard' },
  { value: 45, label: '45 Mins', desc: 'Balanced' },
  { value: 60, label: '1 Hour', desc: 'Hourly' },
  { value: 120, label: '2 Hours', desc: 'Low frequency' },
];

export function getCronExpHelper(minutes: number): string {
  const m = Math.max(1, Math.min(1440, Math.round(minutes)));
  if (m === 1) return '* * * * *';
  if (m < 60) return `*/${m} * * * *`;
  if (m === 60) return '0 * * * *';
  const hours = Math.floor(m / 60);
  if (hours < 24) return `0 */${hours} * * *`;
  return '0 0 * * *';
}

export function YptAutoSyncModal({ isOpen, onClose, onIntervalChanged }: YptAutoSyncModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(15);
  const [customInput, setCustomInput] = useState<string>('15');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAutoFetchPaused, setIsAutoFetchPaused] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ypt_auto_fetch_paused') === 'true';
    } catch {
      return false;
    }
  });

  const toggleAutoFetchPause = () => {
    setIsAutoFetchPaused((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem('ypt_auto_fetch_paused', 'true');
        } else {
          localStorage.removeItem('ypt_auto_fetch_paused');
        }
      } catch (e) {
        console.warn('Could not save auto-fetch pause state to localStorage', e);
      }
      setFeedbackMsg({
        type: 'success',
        text: next
          ? 'Client-side auto-sync is now PAUSED (cron-job.org testing mode).'
          : 'Client-side auto-sync RESUMED.',
      });
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setFeedbackMsg(null);
    getYptSyncInterval()
      .then((mins) => {
        setSelectedMinutes(mins);
        setCustomInput(String(mins));
        const matched = PRESET_INTERVALS.some((p) => p.value === mins);
        setIsCustom(!matched);
      })
      .catch((err) => {
        console.error('Failed to load YPT sync interval:', err);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePresetSelect = (mins: number) => {
    setSelectedMinutes(mins);
    setCustomInput(String(mins));
    setIsCustom(false);
    setFeedbackMsg(null);
  };

  const handleCustomChange = (val: string) => {
    setCustomInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
      setSelectedMinutes(parsed);
    }
    setIsCustom(true);
    setFeedbackMsg(null);
  };

  const handleSave = async () => {
    const minutesToSave = Math.max(1, Math.min(1440, selectedMinutes));
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      await saveYptSyncInterval(minutesToSave);
      setFeedbackMsg({
        type: 'success',
        text: `Sync interval updated to every ${minutesToSave} minute(s) (Cron: ${getCronExpHelper(minutesToSave)})`,
      });
      if (onIntervalChanged) {
        onIntervalChanged(minutesToSave);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to update sync schedule in settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    setFeedbackMsg(null);
    try {
      const res = await triggerContinuousYptSync();
      setFeedbackMsg({
        type: 'success',
        text: res.message || 'Continuous High-Water Mark sync triggered successfully!',
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to trigger immediate sync.',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const currentCron = getCronExpHelper(selectedMinutes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div
        id="ypt-auto-sync-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Auto-Sync Interval Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure background sync frequency for YPT Challenges
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Loading current schedule...</p>
            </div>
          ) : (
            <>
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Continuous High-Water Mark Engine:</span> The background cron automatically polls active YPT rosters, preserving highest recorded peak study times to safeguard member scores.
                </div>
              </div>

              {/* Preset buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                  Select Interval Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_INTERVALS.map((preset) => {
                    const isSelected = !isCustom && selectedMinutes === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handlePresetSelect(preset.value)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                            : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-sm">{preset.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {preset.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Minutes Input */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Custom Interval (Minutes)
                  </label>
                  <span className="text-[11px] text-slate-500">1 to 1440 mins (24h)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customInput}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 20"
                  />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                    Minutes
                  </span>
                </div>
              </div>

              {/* Computed Cron Expression Display */}
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Scheduled Expression: </span>
                    <code className="font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      {currentCron}
                    </code>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Every {selectedMinutes}m
                </span>
              </div>

              {/* Feedback messages */}
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {feedbackMsg.type === 'success' ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAutoFetchPause}
              className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                isAutoFetchPaused
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title={
                isAutoFetchPaused
                  ? 'Client auto-fetch is paused. Click to resume.'
                  : 'Pause client-side auto-fetching to test cron-job.org in isolation.'
              }
            >
              {isAutoFetchPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Auto-Sync</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pause Auto-Sync</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTriggerNow}
              disabled={isTriggering || isSaving || isLoading}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Execute continuous High-Water Mark sync immediately"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
              <span>{isTriggering ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading || !selectedMinutes}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save YPT Sync Schedule</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
