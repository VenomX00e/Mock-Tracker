import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { Plus, Trash2, Save, FileText, Check, Edit2, X } from "lucide-react";
import { CustomDropdown } from "../CustomDropdown";

interface Quote {
  id: string;
  text: string;
  author: string;
}

interface QuotesSettings {
  quotes: Quote[];
  rotationDuration: string; // "6h", "12h", "1d", "2d", "custom"
  customDurationHours?: number;
  lastRotatedAt?: number;
  currentQuoteIdx?: number;
}

const durationOptions = [
  "Every 6 Hours",
  "Every 12 Hours",
  "Every 1 Day",
  "Every 2 Days",
  "Custom"
];

const durationMapFromDb: Record<string, string> = {
  "6h": "Every 6 Hours",
  "12h": "Every 12 Hours",
  "1d": "Every 1 Day",
  "2d": "Every 2 Days",
  "custom": "Custom",
};

const durationMapToDb: Record<string, string> = {
  "Every 6 Hours": "6h",
  "Every 12 Hours": "12h",
  "Every 1 Day": "1d",
  "Every 2 Days": "2d",
  "Custom": "custom",
};

export default function AdminQuotesTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rotationDuration, setRotationDuration] = useState<string>("1d");
  const [customDurationHours, setCustomDurationHours] = useState<number | "">(24);
  
  const [newQuoteText, setNewQuoteText] = useState("");
  const [newQuoteAuthor, setNewQuoteAuthor] = useState("");

  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingQuoteText, setEditingQuoteText] = useState("");
  const [editingQuoteAuthor, setEditingQuoteAuthor] = useState("");

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const docRef = doc(db, "system", "quotesConfig");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as QuotesSettings;
        setQuotes(data.quotes || []);
        setRotationDuration(data.rotationDuration || "1d");
        setCustomDurationHours(data.customDurationHours || 24);
      }
    } catch (error) {
      console.error("Error fetching quotes config", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedQuotes = quotes, updatedRotation = rotationDuration, updatedCustom = customDurationHours) => {
    setSaving(true);
    try {
      const docRef = doc(db, "system", "quotesConfig");
      await setDoc(docRef, {
        quotes: updatedQuotes,
        rotationDuration: updatedRotation,
        customDurationHours: updatedCustom === "" ? 24 : updatedCustom
      }, { merge: true });
    } catch (error) {
      console.error("Error saving quotes", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuote = () => {
    if (!newQuoteText.trim()) return;
    const newQuote: Quote = {
      id: Date.now().toString(),
      text: newQuoteText.trim(),
      author: newQuoteAuthor.trim()
    };
    const updated = [...quotes, newQuote];
    setQuotes(updated);
    handleSave(updated);
    setNewQuoteText("");
    setNewQuoteAuthor("");
  };

  const handleDeleteQuote = (id: string) => {
    const updated = quotes.filter(q => q.id !== id);
    setQuotes(updated);
    handleSave(updated);
  };

  const startEditing = (quote: Quote) => {
    setEditingQuoteId(quote.id);
    setEditingQuoteText(quote.text);
    setEditingQuoteAuthor(quote.author);
  };

  const cancelEditing = () => {
    setEditingQuoteId(null);
    setEditingQuoteText("");
    setEditingQuoteAuthor("");
  };

  const saveEditedQuote = () => {
    if (!editingQuoteId || !editingQuoteText.trim()) return;
    
    const updated = quotes.map(q => {
      if (q.id === editingQuoteId) {
        return {
          ...q,
          text: editingQuoteText.trim(),
          author: editingQuoteAuthor.trim()
        };
      }
      return q;
    });

    setQuotes(updated);
    handleSave(updated);
    cancelEditing();
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading quotes...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Manage Home Quotes
        </h3>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-6">
          
          {/* General Settings */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-4 text-sm uppercase tracking-wide">General Quote Setting</h4>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Change Duration
                </label>
                <div className="w-full">
                  <CustomDropdown
                    value={durationMapFromDb[rotationDuration] || "Every 1 Day"}
                    options={durationOptions}
                    onChange={(val) => {
                      const dbValue = durationMapToDb[val] || "1d";
                      setRotationDuration(dbValue);
                      handleSave(undefined, dbValue);
                    }}
                    placeholder="Select Duration"
                    buttonClassName="w-full text-left px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 dark:text-slate-200"
                  />
                </div>
              </div>
              
              {rotationDuration === "custom" && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Duration (Hours)
                  </label>
                  <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                    type="number"
                    min={1}
                    value={customDurationHours}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomDurationHours(val === "" ? "" : Number(val));
                    }}
                    onBlur={() => handleSave(undefined, undefined, customDurationHours === "" ? 24 : customDurationHours)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-white dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Add New Quote */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              Add New Quote
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quote Text *</label>
                <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                  value={newQuoteText}
                  onChange={e => setNewQuoteText(e.target.value)}
                  placeholder="e.g. The only way to do great work is to love what you do."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 resize-none h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author Name (Optional)</label>
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                  type="text"
                  value={newQuoteAuthor}
                  onChange={e => setNewQuoteAuthor(e.target.value)}
                  placeholder="e.g. Steve Jobs"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
                />
              </div>
              <button
                onClick={handleAddQuote}
                disabled={!newQuoteText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Quote
              </button>
            </div>
          </div>

          {/* Existing Quotes */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">Existing Quotes ({quotes.length})</h4>
            {quotes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                No quotes added yet. Add your first quote above!
              </div>
            ) : (
              <div className="grid gap-4">
                {quotes.map(q => (
                  <div key={q.id} className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-4 group">
                    {editingQuoteId === q.id ? (
                      <div className="space-y-4 w-full">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Quote Text</label>
                          <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                            value={editingQuoteText}
                            onChange={(e) => setEditingQuoteText(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-200 resize-none h-20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Author (Optional)</label>
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
                            type="text"
                            value={editingQuoteAuthor}
                            onChange={(e) => setEditingQuoteAuthor(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 dark:text-slate-200"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEditedQuote}
                            disabled={!editingQuoteText.trim()}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4 w-full">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-slate-200 font-medium italic">"{q.text}"</p>
                          {q.author && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">— {q.author}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditing(q)}
                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition shrink-0"
                            title="Edit quote"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuote(q.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition shrink-0"
                            title="Delete quote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
