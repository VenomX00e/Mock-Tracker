import React from "react";
import { Key, Save } from "lucide-react";

interface AdminApiKeysTabProps {
  apdfKeys: string[];
  setApdfKeys: (val: string[]) => void;
  ilovePdfKeys: string[];
  setIlovePdfKeys: (val: string[]) => void;
  cloudinaryCloudName: string;
  setCloudinaryCloudName: (val: string) => void;
  cloudinaryUploadPreset: string;
  setCloudinaryUploadPreset: (val: string) => void;
  savingSettings: boolean;
  saveSettings: (silent?: boolean | React.FocusEvent<HTMLInputElement>) => void;
}

export function AdminApiKeysTab({
  apdfKeys, setApdfKeys,
  ilovePdfKeys, setIlovePdfKeys,
  cloudinaryCloudName, setCloudinaryCloudName,
  cloudinaryUploadPreset, setCloudinaryUploadPreset,
  savingSettings, saveSettings
}: AdminApiKeysTabProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
          API Keys Management
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              apdf.io API Keys (Comma-separated)
            </label>
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              type="text"
              value={apdfKeys.join(",")}
              onChange={(e) => setApdfKeys(e.target.value.split(",").map(k => k.trim()).filter(k => k))}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
              placeholder="key1, key2, key3..."
            />
            <p className="mt-1 text-xs text-slate-500">
              These keys will be used round-robin for PDF compression to avoid limits.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              iLovePDF API Keys (One pair per line)
            </label>
            <textarea
              value={ilovePdfKeys.join("\n")}
              onChange={(e) => setIlovePdfKeys(e.target.value.split("\n").map(k => k.trim()).filter(k => k))}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 min-h-[100px]"
              placeholder="publicKey1:secretKey1&#10;publicKey2:secretKey2"
            />
            <p className="mt-1 text-xs text-slate-500">
              Format: publicKey:secretKey (e.g. project_public_xxx:secret_key_yyy). Used round-robin for fallback compression.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">Cloudinary Settings</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cloudinary Cloud Name
                </label>
                <input
                  type="text"
                  value={cloudinaryCloudName}
                  onChange={(e) => setCloudinaryCloudName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                  placeholder="e.g. diibbkqyr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Upload Preset (Unsigned)
                </label>
                <input
                  type="text"
                  value={cloudinaryUploadPreset}
                  onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400"
                  placeholder="e.g. mocksight_pdfs"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Ensure the upload preset is configured as "Unsigned" in your Cloudinary settings to allow direct uploads from users without exposing a secret key.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => saveSettings(false)}
            disabled={savingSettings}
            className="mt-4 w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />{" "}
            {savingSettings ? "Saving..." : "Save API Keys"}
          </button>
        </div>
      </div>
    </div>
  );
}
