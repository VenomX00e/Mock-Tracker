import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown'; // Fix import later if needed, assuming they're in the same dir

export function ReflectionEditor({ mock, onSave, onCancel }) {
  const [localNote, setLocalNote] = useState(mock.note || '');
  const [localTags, setLocalTags] = useState(mock.tags ? mock.tags.join(', ') : '');
  const [localDifficulty, setLocalDifficulty] = useState(mock.difficulty || '');
  const [localNervousness, setLocalNervousness] = useState(mock.nervousness || '');
  const [localFocus, setLocalFocus] = useState(mock.focus || '');
  const [localEnergy, setLocalEnergy] = useState(mock.energy || '');
  const [localTimeState, setLocalTimeState] = useState(mock.timeState || '');
  const [localTasks, setLocalTasks] = useState<any[]>(mock.tasks || []);
  const [isSavingReflection, setIsSavingReflection] = useState(false);

  const handleSave = async () => {
    setIsSavingReflection(true);
    try {
      const tagsArray = localTags.split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(t => t.length > 0);

      await onSave(mock.id, {
        note: localNote,
        tags: tagsArray,
        difficulty: localDifficulty,
        nervousness: localNervousness,
        focus: localFocus,
        energy: localEnergy,
        timeState: localTimeState,
        tasks: localTasks
      });
    } finally {
      setIsSavingReflection(false);
    }
  };

  return (
    <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="w-full">
          <label className="block text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Difficulty</label>
          <CustomDropdown 
            value={localDifficulty} 
            onChange={setLocalDifficulty} 
            options={['Easy', 'Ok Ok', 'Hard']}
            placeholder="(Optional)"
            allowClear 
          />
        </div>
        <div className="w-full">
          <label className="block text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Nervousness</label>
          <CustomDropdown 
            value={localNervousness} 
            onChange={setLocalNervousness} 
            options={['Low', 'Manageable', 'High', 'Panicked']}
            placeholder="(Optional)"
            allowClear 
          />
        </div>
        <div className="w-full">
          <label className="block text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Focus</label>
          <CustomDropdown 
            value={localFocus} 
            onChange={setLocalFocus} 
            options={['Distracted', 'Normal', 'Full focused']}
            placeholder="(Optional)"
            allowClear 
          />
        </div>
        <div className="w-full">
          <label className="block text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Energy Level</label>
          <CustomDropdown 
            value={localEnergy} 
            onChange={setLocalEnergy} 
            options={['Rested', 'Bit tired', 'Exhausted']}
            placeholder="(Optional)"
            allowClear 
          />
        </div>
        <div className="w-full">
          <label className="block text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Time</label>
          <CustomDropdown 
            value={localTimeState} 
            onChange={setLocalTimeState} 
            options={['Finished early', 'Perfect pacing', 'Rushed at the end', 'Ran out of time']}
            placeholder="(Optional)"
            allowClear 
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tags (comma separated)</label>
        <input 
          type="text" 
          value={localTags} 
          onChange={e => setLocalTags(e.target.value)} 
          placeholder="e.g. Tough Quant, Bad English"
          className="w-full text-sm border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reflection / Notes</label>
        <textarea 
          value={localNote} 
          onChange={e => setLocalNote(e.target.value)} 
          placeholder="What went well? What went wrong?"
          className="w-full text-sm border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-slate-800 dark:text-slate-200 min-h-[80px] resize-y custom-scrollbar"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Action Items / To-Do</label>
          <button 
            onClick={() => setLocalTasks([...localTasks, { id: Math.random().toString(36).substr(2, 9), text: '', completed: false }])}
            className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors"
          >
            + Add Task
          </button>
        </div>
        <div className="space-y-2">
          {localTasks.map((task, index) => (
            <div key={task.id} className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
              <input 
                type="checkbox" 
                checked={task.completed}
                onChange={(e) => {
                  const newTasks = [...localTasks];
                  newTasks[index].completed = e.target.checked;
                  setLocalTasks(newTasks);
                }}
                className="w-4 h-4 text-indigo-600 cursor-pointer border-slate-300 rounded focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <input 
                type="text" 
                value={task.text}
                onChange={(e) => {
                  const newTasks = [...localTasks];
                  newTasks[index].text = e.target.value;
                  setLocalTasks(newTasks);
                }}
                placeholder="Task description..."
                className={`flex-1 text-sm bg-transparent border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 p-1 rounded ${task.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}
              />
              <button 
                onClick={() => setLocalTasks(localTasks.filter(t => t.id !== task.id))}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button 
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >Cancel</button>
        <button 
          onClick={handleSave}
          disabled={isSavingReflection}
          className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-70 flex items-center"
        >
          {isSavingReflection ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" /> : null}
          Save Reflection
        </button>
      </div>
    </div>
  );
}
