import React, { useState } from "react";
import { Settings, Save, Clock, Zap, Shield, Play, Check, AlertCircle } from "lucide-react";
import { AdminMigrationTool } from "../AdminMigrationTool";
import { CustomDropdown } from "../CustomDropdown";
import { getCronExpHelper } from "../learning/ypt/YptAutoSyncModal";
import { triggerContinuousYptSync } from "../../services/yptService";

interface AdminSettingsTabProps {
  telegramLink: string;
  setTelegramLink: (val: string) => void;
  telegramText: string;
  setTelegramText: (val: string) => void;
  mockExtractionModel: string;
  setMockExtractionModel: (val: string) => void;
  yptSyncIntervalMinutes?: number;
  setYptSyncIntervalMinutes?: (val: number) => void;
  savingSettings: boolean;
  saveSettings: (silent?: boolean | React.FocusEvent<HTMLInputElement>) => void;
  isOwner: boolean;
}

const PRESETS = [
  { value: 5, label: "5 Mins" },
  { value: 10, label: "10 Mins" },
  { value: 15, label: "15 Mins (Default)" },
  { value: 30, label: "30 Mins" },
  { value: 45, label: "45 Mins" },
  { value: 60, label: "1 Hour" },
  { value: 120, label: "2 Hours" },
];

const MODELS = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Default)' },
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B IT' },
  { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT' }
];

export function AdminSettingsTab({
  telegramLink, setTelegramLink,
  telegramText, setTelegramText,
  mockExtractionModel, setMockExtractionModel,
  yptSyncIntervalMinutes = 15,
  setYptSyncIntervalMinutes,
  savingSettings, saveSettings,
  isOwner
}: AdminSettingsTabProps) {
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTriggerSync = async () => {
    setIsTriggeringSync(true);
    setSyncFeedback(null);
    try {
      const res = await triggerContinuousYptSync();
      setSyncFeedback({ type: 'success', text: res.message || 'Continuous YPT sync executed successfully!' });
    } catch (e: any) {
      setSyncFeedback({ type: 'error', text: e.message || 'Failed to trigger continuous sync' });
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const currentCron = getCronExpHelper(yptSyncIntervalMinutes);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
          System Settings
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-8">
          
          {/* YPT Challenge Background Sync Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h4 className="font-medium text-slate-800 dark:text-slate-200">
                  YPT Challenge Continuous Auto-Sync
                </h4>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                Every {yptSyncIntervalMinutes} mins
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Background cron job that continuously polls active YPT group rosters and updates open challenge daily snapshots using High-Water Mark peak tracking.
            </p>

            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Quick Interval Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((p) => {
                  const isSelected = yptSyncIntervalMinutes === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setYptSyncIntervalMinutes?.(p.value)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span>{p.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input & Cron Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Custom Interval (1 - 1440 Minutes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={yptSyncIntervalMinutes}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      if (!isNaN(num) && num > 0) {
                        setYptSyncIntervalMinutes?.(num);
                      }
                    }}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                    placeholder="15"
                  />
                  <span className="text-xs font-semibold text-slate-500 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                    Minutes
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Computed Cron Expression
                </label>
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>{currentCron}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Runs every {yptSyncIntervalMinutes}m
                  </span>
                </div>
              </div>
            </div>

            {/* Sync Feedback */}
            {syncFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  syncFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                }`}
              >
                {syncFeedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{syncFeedback.text}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => saveSettings(false)}
                disabled={savingSettings}
                className="flex-1 justify-center inline-flex items-center px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2" />{" "}
                {savingSettings ? "Saving..." : "Save YPT Sync Schedule"}
              </button>

              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isTriggeringSync}
                className="justify-center inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
                title="Execute background continuous sync right now"
              >
                <Play className={`w-4 h-4 mr-1.5 ${isTriggeringSync ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
                <span>{isTriggeringSync ? "Syncing..." : "Trigger Sync Now"}</span>
              </button>
            </div>
          </div>

          {/* Telegram Settings */}
          <div className="space-y-4 border-t border-slate-200 dark:border-slate-700/50 pt-8">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">Telegram Settings</h4>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Telegram Support Link
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="url"
                value={telegramLink}
                onChange={(e) => setTelegramLink(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                placeholder="https://t.me/yourgroup"
              />
              <p className="mt-1 text-xs text-slate-500">
                This will be shown on the login screen and header for support.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Telegram Button Text
              </label>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                type="text"
                value={telegramText}
                onChange={(e) => setTelegramText(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                placeholder="Contact us"
              />
              <p className="mt-1 text-xs text-slate-500">
                The text to display on the Telegram button.
              </p>
            </div>

            <button
              onClick={() => saveSettings(false)}
              disabled={savingSettings}
              className="mt-4 w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {savingSettings ? "Saving..." : "Save Telegram Settings"}
            </button>
          </div>

          {/* Model Settings */}
          <div className="space-y-4 border-t border-slate-200 dark:border-slate-700/50 pt-8">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">AI Model Settings</h4>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Add Mock Score Extraction Model
              </label>
              <CustomDropdown
                value={MODELS.find((m) => m.value === mockExtractionModel)?.label || "Select Model"}
                options={MODELS.map((m) => m.label)}
                onChange={(label) => {
                  const selected = MODELS.find((m) => m.label === label);
                  if (selected) setMockExtractionModel(selected.value);
                }}
                placeholder="Select a model"
              />
              <p className="mt-1 text-xs text-slate-500">
                Select the model to be used by all users when extracting mock details and scores from images.
              </p>
            </div>
            
            <button
              onClick={() => saveSettings(false)}
              disabled={savingSettings}
              className="mt-4 w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />{" "}
              {savingSettings ? "Saving..." : "Save Model Settings"}
            </button>
          </div>

          {isOwner && (
            <div className="pt-8 mt-8 border-t border-slate-200 dark:border-slate-700/50">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Owner Tools</h4>
              <AdminMigrationTool />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
