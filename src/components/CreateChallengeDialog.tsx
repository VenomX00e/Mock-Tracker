import React, { useState } from 'react';
import { X, Globe, Lock, Trash2, Sparkles, Loader2, RefreshCcw } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { db } from '../services/firebase';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import { generateBadge as generateBadgeService } from '../services/geminiService';

interface CreateChallengeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  initialData?: any;
  categoryId?: string;
  categories?: any[];
  isAdmin?: boolean;
  isOwner?: boolean;
}

export function CreateChallengeDialog({ isOpen, onClose, uid, initialData, categoryId, categories, isAdmin, isOwner }: CreateChallengeDialogProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [challengeType, setChallengeType] = useState(initialData?.challengeType || 'streak');
  const [tasks, setTasks] = useState<{id: string, text: string}[]>(initialData?.tasks || []);
  const [todoFrequency, setTodoFrequency] = useState<'oneTime' | 'daily'>(initialData?.todoFrequency || 'daily');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [duration, setDuration] = useState(initialData?.durationDays ? String(initialData.durationDays) : '');
  const [visibility, setVisibility] = useState<'global' | 'personal'>(initialData?.visibility || 'personal');
  const [generateBadge, setGenerateBadge] = useState(false);
  const [customBadge, setCustomBadge] = useState<any>(null);
  const [badgePrompt, setBadgePrompt] = useState('');
  const [isGeneratingBadge, setIsGeneratingBadge] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen && initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setChallengeType(initialData.challengeType || 'streak');
      setTasks(initialData.tasks || []);
      setTodoFrequency(initialData.todoFrequency || 'daily');
      setStartDate(initialData.startDate || '');
      setEndDate(initialData.endDate || '');
      setDuration(initialData.durationDays ? String(initialData.durationDays) : '');
      setVisibility(initialData.visibility || 'personal');
      setGenerateBadge(!!initialData.badge);
      setCustomBadge(initialData.badge || null);
    } else if (isOpen && !initialData) {
      setGenerateBadge(false);
      setCustomBadge(null);
      setBadgePrompt('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const BADGE_ICONS = ['🏅', '🏆', '🎖️', '🥇', '🌟', '💎', '🔥', '🎯', '⚡', '👑'];
  const BADGE_COLORS = [
    'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
    'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
    'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
  ];

  const handleGenerateBadge = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
           await (window as any).aistudio.openSelectKey();
           return; 
        }
      }
    } catch(e) {
      console.warn("AI Studio key check failed", e);
    }

    setIsGeneratingBadge(true);
    try {
       const badge = await generateBadgeService(badgePrompt || (title ? `A badge for a challenge named ${title}` : 'random'));
       setCustomBadge(badge);
    } catch (e: any) {
       console.error("Failed to generate badge", e);
       alert(e.message || "Failed to generate badge. Image generation requires billing enabled / paid tier API Key in this region. You can go to Settings > Secrets in AI Studio to provide a custom key.");
    } finally {
       setIsGeneratingBadge(false);
    }
  };

  const handleSave = async () => {
    if (!title || !startDate || !endDate) {
      alert("Please fill in title, start date, and end date");
      return;
    }

    setIsSaving(true);
    try {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      
      if (end <= start) {
        alert("End date must be after start date");
        setIsSaving(false);
        return;
      }
      
      const durationDays = duration ? parseInt(duration) : Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const isGlobal = visibility === 'global';
      const cleanTasks = tasks.map(t => ({...t, text: t.text.trim()})).filter(t => t.text.length > 0);
      const payload: any = {
        title,
        description: description || '',
        challengeType,
        todoFrequency,
        visibility,
        tasks: cleanTasks,
        startDate: startDate,
        endDate: endDate,
        durationDays,
        status: initialData?.status || 'active',
        // User created global challenge goes to pending, personal goes to approved.
        // If switching from personal to global, MUST go to pending
        approvalStatus: isGlobal ? (initialData?.visibility === 'personal' ? 'pending' : (initialData?.approvalStatus || 'pending')) : 'approved',
        updatedAt: new Date().toISOString()
      };

      if (isOwner && isGlobal && generateBadge) {
        if (customBadge) {
          payload.badge = { ...customBadge };
        } else {
          payload.badge = {
            icon: BADGE_ICONS[Math.floor(Math.random() * BADGE_ICONS.length)],
            color: BADGE_COLORS[Math.floor(Math.random() * BADGE_COLORS.length)],
            name: `${title} Finisher`
          };
        }
      } else if (initialData?.badge && !generateBadge) {
        payload.badge = deleteField();
      }

      if (!initialData) {
        payload.creatorId = uid;
        payload.createdAt = new Date().toISOString();
        if (categoryId) payload.categoryId = categoryId;
      }

      let idPrefix = 'usr_chal';
      if (!initialData && categoryId) {
        const currentCat = categories?.find(c => c.id === categoryId);
        const prefix = currentCat?.subjectPrefix || categoryId;
        idPrefix = `${prefix.replace(/_$/, '').toUpperCase()}_CHALLENGE`;
      }

      const id = initialData?.id || `${idPrefix}_${Date.now()}`;
      await setDoc(doc(db, 'challenges', id), payload, { merge: true });
      
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setDuration('');
      setTasks([]);
      setTodoFrequency('daily');
      setVisibility('personal');
      onClose();
    } catch (e) {
      console.error("Error creating/updating challenge", e);
      alert("Failed to save challenge");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50  z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Create New Challenge</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
           <div>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Challenge Title</label>
             <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" placeholder="e.g. 50 Days Mock Challenge" />
           </div>
           
           <div>
             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
             <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200" placeholder="e.g. Can you maintain a mock streak for 50 days?" />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Visibility</label>
               <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                 <button 
                   onClick={() => setVisibility('global')}
                   className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${visibility === 'global' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                 >
                   <Globe className="w-3.5 h-3.5" /> Global
                 </button>
                 <button 
                   onClick={() => setVisibility('personal')}
                   className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${visibility === 'personal' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                 >
                   <Lock className="w-3.5 h-3.5" /> Personal
                 </button>
               </div>
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Challenge Type</label>
               <CustomDropdown 
                 value={challengeType === 'streak' ? 'Check-in' : challengeType === 'uploadMock' ? 'Upload Mock' : 'To-Do'}
                 options={['Check-in', 'Upload Mock', 'To-Do']}
                 onChange={(val) => setChallengeType(val === 'Check-in' ? 'streak' : val === 'Upload Mock' ? 'uploadMock' : 'todo')}
                 placeholder="Select Type"
               />
             </div>
           </div>

           {isOwner && visibility === 'global' && (
             <div className="space-y-3">
               <div className="flex items-center gap-4">
                 <label className="flex items-center gap-2 cursor-pointer w-fit select-none">
                   <input type="checkbox" checked={generateBadge} onChange={(e) => setGenerateBadge(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                   <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Award Badge on Completion</span>
                 </label>
                 {generateBadge && customBadge && customBadge.imageBase64 && (
                   <div className={`px-2 py-1 rounded text-xs border font-bold flex items-center gap-2 bg-slate-50 dark:bg-slate-800`}>
                     <img src={customBadge.imageBase64} alt="Badge Preview" className="w-8 h-8 rounded-full shadow border-2 border-white dark:border-slate-700 object-cover" />
                     <span>{customBadge.name}</span>
                   </div>
                 )}
               </div>
               {generateBadge && (
                  <div className="flex flex-col gap-2 p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                     <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={badgePrompt} 
                         onChange={(e) => setBadgePrompt(e.target.value)} 
                         placeholder="Describe badge (e.g. 'Golden fire for 50 days')"
                         className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" 
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             e.preventDefault();
                             handleGenerateBadge();
                           }
                         }}
                       />
                       <button 
                         onClick={handleGenerateBadge}
                         disabled={isGeneratingBadge}
                         className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50 h-8"
                       >
                         {isGeneratingBadge ? <Loader2 className="w-4 h-4 animate-spin" /> : (customBadge ? <RefreshCcw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />)}
                         {customBadge ? 'Regenerate' : 'Generate'}
                       </button>
                     </div>
                     {customBadge && (
                       <div className="flex items-center justify-end pt-1">
                          <button onClick={() => setCustomBadge(null)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3"/> Clear badge</button>
                       </div>
                     )}
                     {!customBadge && (
                       <div className="text-xs text-slate-500 dark:text-slate-400">
                         If you don't generate, a random badge will be assigned automatically on save.
                       </div>
                     )}
                  </div>
               )}
             </div>
           )}

           <div className="grid grid-cols-3 gap-2">
             <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
               <input type="date" value={startDate} onChange={e => {
                 const newStart = e.target.value;
                 setStartDate(newStart);
                 if (newStart && duration) {
                   const d = new Date(newStart);
                   d.setDate(d.getDate() + parseInt(duration));
                   setEndDate(d.toISOString().split('T')[0]);
                 } else if (newStart && endDate) {
                   const sTime = new Date(newStart).getTime();
                   const eTime = new Date(endDate).getTime();
                   if (eTime > sTime) {
                     setDuration(Math.ceil((eTime - sTime) / (1000 * 60 * 60 * 24)).toString());
                   }
                 }
               }} className="w-full px-2 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 focus:outline-none focus:ring-2 ring-indigo-500/20" />
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duration</label>
               <input type="number" placeholder="Days" value={duration} onChange={e => {
                 const newDuration = e.target.value;
                 setDuration(newDuration);
                 if (newDuration && startDate) {
                   const d = new Date(startDate);
                   d.setDate(d.getDate() + parseInt(newDuration));
                   setEndDate(d.toISOString().split('T')[0]);
                 }
               }} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 focus:outline-none focus:ring-2 ring-indigo-500/20" />
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
               <input type="date" value={endDate} onChange={e => {
                 const newEnd = e.target.value;
                 setEndDate(newEnd);
                 if (newEnd && startDate) {
                   const sTime = new Date(startDate).getTime();
                   const eTime = new Date(newEnd).getTime();
                   if (eTime > sTime) {
                     setDuration(Math.ceil((eTime - sTime) / (1000 * 60 * 60 * 24)).toString());
                   }
                 }
               }} className="w-full px-2 py-2 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200 focus:outline-none focus:ring-2 ring-indigo-500/20" />
             </div>
           </div>

           <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
             <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Challenge Tasks <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                {tasks.length > 0 && (
                  <button 
                   type="button"
                   onClick={() => setTodoFrequency(prev => prev === 'oneTime' ? 'daily' : 'oneTime')}
                   className="py-1 px-2.5 text-[10px] font-bold rounded overflow-hidden bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                   title={todoFrequency === 'oneTime' ? 'Check each task only once.' : 'Tasks renew daily.'}
                  >
                   {todoFrequency === 'oneTime' ? 'Once' : 'Daily'}
                  </button>
                )}
             </div>
             <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
               {tasks.map((t, idx) => (
                 <div key={t.id} className="flex items-center gap-2">
                   <input type="text" value={t.text} onChange={(e) => {
                     const newTasks = [...tasks];
                     newTasks[idx].text = e.target.value;
                     setTasks(newTasks);
                   }} className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm bg-white dark:bg-slate-900/50 dark:text-slate-200" placeholder="Task description..." />
                   <button onClick={() => setTasks(tasks.filter(item => item.id !== t.id))} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg shrink-0" title="Delete Task"><Trash2 className="w-4 h-4" /></button>
                 </div>
               ))}
             </div>
             <button onClick={() => setTasks([...tasks, { id: Math.random().toString(36).substring(2,9), text: '' }])} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-2 flex items-center gap-1">+ Add Task</button>
           </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-70"
          >
            {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            Create Challenge
          </button>
        </div>
      </div>
    </div>
  );
}
