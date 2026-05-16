import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CustomDropdown } from './CustomDropdown';
import { useSystemDataCtx } from '../context/AppContext';

interface EditCountdownDialogProps {
  countdownData: any;
  isOpen: boolean;
  onClose: () => void;
}

export const EditCountdownDialog: React.FC<EditCountdownDialogProps> = ({
  countdownData,
  isOpen,
  onClose
}) => {
  const { fetchAnnouncement } = useSystemDataCtx();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState('green');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && countdownData) {
      setTitle(countdownData.title || '');
      setDate(countdownData.date || '');
      setNote(countdownData.note || '');
      setColor(countdownData.color || 'green');
    }
  }, [isOpen, countdownData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title || !date) {
      alert("Countdown title and date are required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        type: "countdown",
        title,
        date,
        note: note || "",
        color,
        updatedAt: new Date().toISOString(),
      };
      
      const newId = countdownData.id;
      if (countdownData.categoryId) {
        payload.categoryId = countdownData.categoryId;
      }
      
      await setDoc(doc(db, "system", newId), payload, { merge: true });
      await fetchAnnouncement();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save countdown");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50  sm:p-6 pb-20 sm:pb-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Edit Countdown
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="e.g. IBPS PO Prelims"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Date <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="e.g. Admit cards out soon!"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Theme Color
            </label>
            <CustomDropdown
              value={
                color === "green"
                  ? "Green"
                  : color === "light-green"
                    ? "Light Green"
                    : color === "orange"
                      ? "Orange"
                      : color === "light-red"
                        ? "Light Red"
                        : color === "red"
                          ? "Red"
                          : "Green"
              }
              options={["Green", "Light Green", "Orange", "Light Red", "Red"]}
              placeholder="Select Theme Color"
              onChange={(val) => {
                const mapped =
                  val === "Light Green"
                    ? "light-green"
                    : val === "Light Red"
                      ? "light-red"
                      : val.toLowerCase();
                setColor(mapped);
              }}
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full justify-center inline-flex items-center px-4 py-3 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Update Countdown"}
          </button>
        </div>
      </div>
    </div>
  );
};
