import React from "react";
import { Settings, Save } from "lucide-react";
import { AdminMigrationTool } from "../AdminMigrationTool";
import { CustomDropdown } from "../CustomDropdown";

interface AdminSettingsTabProps {
  telegramLink: string;
  setTelegramLink: (val: string) => void;
  telegramText: string;
  setTelegramText: (val: string) => void;
  mockExtractionModel: string;
  setMockExtractionModel: (val: string) => void;
  savingSettings: boolean;
  saveSettings: (silent?: boolean | React.FocusEvent<HTMLInputElement>) => void;
  isOwner: boolean;
}

const MODELS = [
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Default)' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B IT' },
  { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT' },
];

export function AdminSettingsTab({
  telegramLink, setTelegramLink,
  telegramText, setTelegramText,
  mockExtractionModel, setMockExtractionModel,
  savingSettings, saveSettings,
  isOwner
}: AdminSettingsTabProps) {
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
          
          {/* Telegram Settings */}
          <div className="space-y-4">
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
