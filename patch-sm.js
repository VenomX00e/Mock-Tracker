import fs from 'fs';
let code = fs.readFileSync('src/components/AdminCategoriesTab.tsx', 'utf8');

const signatureTarget = `function SubjectManager({
  subjects,
  onChange,
}: {
  subjects: { id: string; name: string; short?: string }[];
  onChange: (subs: { id: string; name: string; short?: string }[]) => void;
}) {`;

const signatureReplacement = `function SubjectManager({
  subjects,
  onChange,
  availablePhases,
}: {
  subjects: { id: string; name: string; short?: string; phases?: string[] }[];
  onChange: (subs: { id: string; name: string; short?: string; phases?: string[] }[]) => void;
  availablePhases: string[];
}) {`;

code = code.replace(signatureTarget, signatureReplacement);

const stateTarget = `  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");`;

const stateReplacement = `  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");
  const [newSubPhases, setNewSubPhases] = useState<string[]>([]);
  const [editPhases, setEditPhases] = useState<string[]>([]);`;

code = code.replace(stateTarget, stateReplacement);

const handleAddTarget = `    if (newSubName.trim()) {
      const id =
        newSubId.trim() ||
        newSubName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
      onChange([
        ...(subjects || []),
        { id, name: newSubName.trim(), short: newSubShort.trim() },
      ]);
      setNewSubId("");
      setNewSubName("");
      setNewSubShort("");
    }
  };`;

const handleAddReplacement = `    if (newSubName.trim()) {
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
  };`;

code = code.replace(handleAddTarget, handleAddReplacement);

const handleEditTarget = `      newSubs[index] = { id, name: editName.trim(), short: editShort.trim() };
      onChange(newSubs);
    }
    setEditingIndex(null);
  };`;

const handleEditReplacement = `      newSubs[index] = { id, name: editName.trim(), short: editShort.trim(), phases: editPhases.length ? editPhases : undefined };
      onChange(newSubs);
    }
    setEditingIndex(null);
  };`;

code = code.replace(handleEditTarget, handleEditReplacement);

const editUiTarget = `            {editingIndex === i ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
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
            ) : (`

const editUiReplacement = `            {editingIndex === i ? (
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
            ) : (`

code = code.replace(editUiTarget, editUiReplacement);

// Render phases tag if sub.phases exists
const viewUiTarget = `                    {sub.short ? (
                      <span className="text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs ml-1 font-bold">
                        {sub.short}
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {sub.id}
                  </span>
                </div>
              </div>`
              
const viewUiReplacement = `                    {sub.short ? (
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
              </div>`
              
code = code.replace(viewUiTarget, viewUiReplacement);

const newUiTarget = `      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-200 border-dashed dark:border-slate-700/50">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
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
        <button
          onClick={handleAdd}
          disabled={!newSubName.trim()}
          className="px-4 py-2 w-full md:w-auto bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-300 disabled:opacity-50 flex gap-2 items-center justify-center"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
      </div>`

const newUiReplacement = `      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-200 border-dashed dark:border-slate-700/50">
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
      </div>`

code = code.replace(newUiTarget, newUiReplacement);


// Update edit click to set editPhases
const editClickTarget = `                    onClick={() => {
                      setEditId(sub.id);
                      setEditName(sub.name);
                      setEditShort(sub.short || "");
                      setEditingIndex(i);
                    }}`

const editClickReplacement = `                    onClick={() => {
                      setEditId(sub.id);
                      setEditName(sub.name);
                      setEditShort(sub.short || "");
                      setEditPhases(sub.phases || []);
                      setEditingIndex(i);
                    }}`
code = code.replace(editClickTarget, editClickReplacement);

// Update caller of SubjectManager
const callTarget = `<SubjectManager
                        subjects={workingCat.subjects || []}
                        onChange={(subs) =>
                          setWorkingCat({ ...workingCat, subjects: subs })
                        }
                      />`
const callReplacement = `<SubjectManager
                        subjects={workingCat.subjects || []}
                        onChange={(subs) =>
                          setWorkingCat({ ...workingCat, subjects: subs })
                        }
                        availablePhases={workingCat.phases || []}
                      />`
code = code.replace(callTarget, callReplacement);

fs.writeFileSync('src/components/AdminCategoriesTab.tsx', code);
console.log('patched');
