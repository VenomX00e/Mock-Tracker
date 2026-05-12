import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, X, Edit2, ChevronRight, ChevronDown, Check } from "lucide-react";
export function SubjectManager({
  subjects,
  onChange,
  availablePhases,
}: {
  subjects: { id: string; name: string; short?: string; phases?: string[] }[];
  onChange: (subs: { id: string; name: string; short?: string; phases?: string[] }[]) => void;
  availablePhases: string[];
}) {
  const [newSubId, setNewSubId] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [newSubShort, setNewSubShort] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");
  const [newSubPhases, setNewSubPhases] = useState<string[]>([]);
  const [editPhases, setEditPhases] = useState<string[]>([]);

  const handleAdd = () => {
    if (newSubName.trim()) {
      const id =
        newSubId.trim() ||
        newSubName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
      onChange([
        ...(subjects || []),
        { id, name: newSubName.trim(), short: newSubShort.trim(), phases: newSubPhases.length ? newSubPhases : undefined },
      ]);
      setNewSubId("");
      setNewSubName("");
      setNewSubShort("");
      setNewSubPhases([]);
    }
  };

  const handleEditSave = (index: number) => {
    if (editName.trim()) {
      const id =
        editId.trim() ||
        editName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
      const newSubs = [...subjects];
      newSubs[index] = { id, name: editName.trim(), short: editShort.trim(), phases: editPhases.length ? editPhases : undefined };
      onChange(newSubs);
    }
    setEditingIndex(null);
  };

  return (
    <div className="space-y-3">
      {!subjects || subjects.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No sectional subjects defined.
        </p>
      ) : (
        subjects.map((sub, i) => (
          <div
            key={i}
            className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 group"
          >
            {editingIndex === i ? (
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded px-2 py-1.5"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={editShort}
                    onChange={(e) => setEditShort(e.target.value)}
                    className="w-full text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded px-2 py-1.5"
                    placeholder="Short (e.g. Q)"
                  />
                  <input
                    type="text"
                    value={editId}
                    onChange={(e) => setEditId(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded px-2 py-1.5"
                    placeholder="ID"
                  />
                </div>
                {availablePhases?.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 flex items-center">Phases:</span>
                    {availablePhases.map(phase => (
                      <label key={phase} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={editPhases.includes(phase)}
                          onChange={e => {
                            if (e.target.checked) setEditPhases([...editPhases, phase]);
                            else setEditPhases(editPhases.filter(p => p !== phase));
                          }}
                          className="w-3 h-3 text-indigo-600 rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                        />
                        {phase}
                      </label>
                    ))}
                    <span className="text-[10px] text-slate-400 italic ml-2">(None selected = applies to all)</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-48 font-medium text-sm text-slate-700 dark:text-slate-300">
                <div className="flex flex-col">
                  <span>
                    {sub.name}{" "}
                    {sub.short ? (
                      <span className="text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs ml-1 font-bold">
                        {sub.short}
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sub.id}
                    </span>
                    {sub.phases && sub.phases.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {sub.phases.map((p) => (
                          <span key={p} className="text-[8px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded font-medium border border-indigo-100 dark:border-indigo-800/50">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!editingIndex || editingIndex !== i ? (
              <div className="flex-1 flex gap-2 opacity-50 pointer-events-none hidden md:flex">
                <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 py-2 px-3 text-sm text-slate-400">
                  Score
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 py-2 px-3 text-sm text-slate-400">
                  Percentile
                </div>
                <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 py-2 px-3 text-sm text-slate-400">
                  Accuracy
                </div>
              </div>
            ) : (
              <div className="hidden md:block w-px"></div>
            )}

            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
              {editingIndex === i ? (
                <>
                  <button
                    onClick={() => handleEditSave(i)}
                    className="p-1.5 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 w-8 h-8 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="p-1.5 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 w-8 h-8 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditId(sub.id);
                      setEditName(sub.name);
                      setEditShort(sub.short || "");
                      setEditPhases(sub.phases || []);
                      setEditingIndex(i);
                    }}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 w-8 h-8 flex items-center justify-center"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const newS = [...subjects];
                      newS.splice(i, 1);
                      onChange(newS);
                    }}
                    className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 w-8 h-8 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-200 border-dashed dark:border-slate-700/50">
        <div className="flex-1 w-full space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Full Name (e.g. Quantitative Aptitude)"
              className="text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded px-2 py-1.5"
            />
            <input
              type="text"
              value={newSubShort}
              onChange={(e) => setNewSubShort(e.target.value)}
              placeholder="Short Name (e.g. Q)"
              className="text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded px-2 py-1.5"
            />
            <input
              type="text"
              value={newSubId}
              onChange={(e) => setNewSubId(e.target.value)}
              placeholder="ID (optional, e.g. quant)"
              className="text-xs font-mono border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded px-2 py-1.5"
            />
          </div>
          {availablePhases?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 flex items-center">Phases:</span>
              {availablePhases.map(phase => (
                <label key={phase} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSubPhases.includes(phase)}
                    onChange={e => {
                      if (e.target.checked) setNewSubPhases([...newSubPhases, phase]);
                      else setNewSubPhases(newSubPhases.filter(p => p !== phase));
                    }}
                    className="w-3 h-3 text-indigo-600 rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                  />
                  {phase}
                </label>
              ))}
              <span className="text-[10px] text-slate-400 italic ml-2">(None selected = applies to all)</span>
            </div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={!newSubName.trim()}
          className="px-4 py-2 w-full md:w-auto bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-300 disabled:opacity-50 flex gap-2 items-center justify-center shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>
    </div>
  );
}

