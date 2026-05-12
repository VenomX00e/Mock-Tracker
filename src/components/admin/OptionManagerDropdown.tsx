import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, X, Edit2, ChevronRight, ChevronDown, Check } from "lucide-react";
export function OptionManagerDropdown({
  title,
  options,
  onChange,
}: {
  title: string;
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newOpt, setNewOpt] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = () => {
    if (newOpt.trim() && (!options || !options.includes(newOpt.trim()))) {
      onChange([...(options || []), newOpt.trim()]);
      setNewOpt("");
    }
  };

  const handleEditSave = (index: number) => {
    if (editVal.trim()) {
      const newOpts = [...options];
      newOpts[index] = editVal.trim();
      onChange(newOpts);
    }
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    const newOpts = [...options];
    newOpts.splice(index, 1);
    onChange(newOpts);
  };

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all font-medium flex justify-between items-center cursor-pointer text-slate-700 dark:text-slate-200"
      >
        <span>
          {title} {(options?.length || 0) > 0 ? `(${options.length})` : ""}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 min-w-full w-max mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-none p-2 animate-in fade-in slide-in-from-top-2 flex flex-col max-h-80 overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 mb-2 font-medium text-xs text-slate-500 uppercase tracking-wider text-center">
            Manage {title}s
          </div>
          <div className="overflow-y-auto flex-1 space-y-1 mb-2 pr-1 custom-scrollbar">
            {!options || options.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-4">
                No options yet
              </p>
            ) : (
              options.map((opt, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/30 group"
                >
                  {editingIndex === i ? (
                    <div className="flex flex-1 gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditSave(i);
                          else if (e.key === "Escape") setEditingIndex(null);
                        }}
                        className="flex-1 min-w-0 bg-white dark:bg-slate-800 border-none rounded py-0.5 px-1 text-sm focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleEditSave(i)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="p-1 text-slate-400 hover:bg-slate-200 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {opt}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditVal(opt);
                            setEditingIndex(i);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-500"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(i);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
            <input
              type="text"
              placeholder="Add new option..."
              value={newOpt}
              onChange={(e) => setNewOpt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleAdd}
              disabled={!newOpt.trim()}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

