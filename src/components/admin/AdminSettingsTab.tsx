import React from "react";
import { Settings, Save } from "lucide-react";
import { AdminMigrationTool } from "../AdminMigrationTool";

interface AdminSettingsTabProps {
  telegramLink: string;
  setTelegramLink: (val: string) => void;
  telegramText: string;
  setTelegramText: (val: string) => void;
  mockExtractionModel?: string;
  setMockExtractionModel?: (val: string) => void;
  savingSettings: boolean;
  saveSettings: (silent?: boolean | React.FocusEvent<HTMLInputElement>) => void;
  isOwner: boolean;
}

export function AdminSettingsTab({
  telegramLink, setTelegramLink,
  telegramText, setTelegramText,
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
