import React, { useState, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MockScore, ExamCategory } from '../types';
import { parseScorecardImage } from '../services/geminiService';
import { X, Upload, Loader2, ArrowLeft, Image as ImageIcon, BarChart3, Settings, Calculator, Activity, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { CustomDropdown } from './CustomDropdown';

import { EXAMS as fallback_EXAMS, ROLES as fallback_ROLES, PHASES as fallback_PHASES, SCOPES as fallback_SCOPES, PLATFORMS as fallback_PLATFORMS } from '../lib/constants';
import { getErrorMessage } from '../lib/errorUtils';

interface AddMockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mock: MockScore) => void;
  initialMock?: MockScore;
  categories?: ExamCategory[];
  categoryId?: string;
  asPage?: boolean;
}

const SubjectRow = memo(({ sub, data, onChange }: { sub: any, data: any, onChange: (id: string, field: string, val: string) => void }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-500/50">
      <div className="w-full sm:w-[140px] shrink-0 font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <div className="w-2 h-2 shrink-0 rounded-full bg-indigo-500"></div>
        <span className="truncate">{sub.name} {sub.short ? <span className="text-slate-400 font-normal ml-1">({sub.short})</span> : ''}</span>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-3">
        <div className="space-y-1.5 focus-within:relative focus-within:z-10">
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="search" inputMode="decimal" step="0.01"
            placeholder="Score"
            value={data?.score ?? ''}
            onChange={(e) => onChange(sub.id, 'score', e.target.value)}
            className="w-full px-1.5 sm:px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm dark:text-slate-200 transition-all placeholder:text-[10px] sm:placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-1.5 focus-within:relative focus-within:z-10">
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="search" inputMode="decimal" step="0.01"
            placeholder="Percentile"
            value={data?.percentile ?? ''}
            onChange={(e) => onChange(sub.id, 'percentile', e.target.value)}
            className="w-full px-1.5 sm:px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm dark:text-slate-200 transition-all placeholder:text-[10px] sm:placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="space-y-1.5 focus-within:relative focus-within:z-10">
          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"
            type="search" inputMode="decimal" step="0.01"
            placeholder="Accuracy %"
            value={data?.accuracy ?? ''}
            onChange={(e) => onChange(sub.id, 'accuracy', e.target.value)}
            className="w-full px-1.5 sm:px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs sm:text-sm dark:text-slate-200 transition-all placeholder:text-[10px] sm:placeholder:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.sub.id === next.sub.id &&
         prev.data?.score === next.data?.score &&
         prev.data?.percentile === next.data?.percentile &&
         prev.data?.accuracy === next.data?.accuracy;
});

export default function AddMockDialog({ isOpen, onClose, onSave, initialMock, categories, categoryId, asPage = false }: AddMockDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryId || (categories && categories.length > 0 ? categories[0].id : ''));

  const currentCategory = useMemo(() => categories?.find(c => c.id === selectedCategory) || categories?.find(c => c.id === categoryId), [categories, selectedCategory, categoryId]);
  const EXAMS = useMemo(() => currentCategory?.exams && currentCategory.exams.length > 0 ? currentCategory.exams : fallback_EXAMS, [currentCategory]);
  const ROLES = useMemo(() => currentCategory?.roles && currentCategory.roles.length > 0 ? currentCategory.roles : fallback_ROLES, [currentCategory]);
  const PHASES = useMemo(() => currentCategory?.phases && currentCategory.phases.length > 0 ? currentCategory.phases : fallback_PHASES, [currentCategory]);
  const SCOPES = useMemo(() => ['Full', 'Sectional'], []);
  const PLATFORMS = useMemo(() => currentCategory?.platforms && currentCategory.platforms.length > 0 ? currentCategory.platforms : fallback_PLATFORMS, [currentCategory]);
  const allSubjects = useMemo(() => currentCategory?.subjects && currentCategory.subjects.length > 0 ? currentCategory.subjects : [
    { id: 'quant', name: 'Quant' },
    { id: 'reasoning', name: 'Reasoning' },
    { id: 'english', name: 'English' },
    { id: 'ga', name: 'GA' }
  ], [currentCategory]);

  const defaultFormData = useMemo(() => ({
    examType: '',
    examRole: '',
    examPhase: PHASES.length > 0 && PHASES.includes('Prelims') ? 'Prelims' : (PHASES[0] || ''),
    examScope: SCOPES.length > 0 && SCOPES.includes('Full') ? 'Full' : (SCOPES[0] || ''),
    mockName: '',
    platform: '',
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    score: '',
    percentile: '',
    percentage: '',
    accuracy: '',
    ...Object.fromEntries(allSubjects.map((s: any) => [s.id, { score: '', percentile: '', accuracy: '' }]))
  }), [PHASES, SCOPES, allSubjects]);


  const [formData, setFormData] = useState<any>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const subjects = useMemo(() => allSubjects.filter((s: any) => {
    if (!s.phases || s.phases.length === 0) return true;
    return s.phases.includes(formData.examPhase);
  }), [allSubjects, formData.examPhase]);
  
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);

  const initRef = useRef<{ openedWith: string | null }>({ openedWith: null });

  React.useEffect(() => {
    if (isOpen) {
      if (!asPage) {
        document.body.style.overflow = 'hidden';
      }
      
      const currentSignature = initialMock?.id || 'new';
      if (initRef.current.openedWith !== currentSignature) {
        initRef.current.openedWith = currentSignature;
        
        const initialCat = initialMock?.categoryId || categoryId || (categories && categories.length > 0 ? categories[0].id : '');
        setSelectedCategory(initialCat);
        
        const activeCat = categories?.find(c => c.id === initialCat) || categories?.find(c => c.id === categoryId);
        const activeSubjects = activeCat?.subjects && activeCat.subjects.length > 0 ? activeCat.subjects : [
          { id: 'quant', name: 'Quant' },
          { id: 'reasoning', name: 'Reasoning' },
          { id: 'english', name: 'English' },
          { id: 'ga', name: 'GA' }
        ];

        if (initialMock) {
          let safeDate = initialMock.date || '';
          if (safeDate && safeDate.length > 16) {
             safeDate = safeDate.slice(0, 16);
          }

          setFormData(prev => ({ 
            ...defaultFormData, 
            ...prev, 
            ...initialMock, 
            date: safeDate || prev.date || defaultFormData.date,
            ...(initialMock.dynamicSubjects || {}) 
          }));
          
          setIsCustomExam(!['', 'Live Mock', ...(activeCat?.exams || fallback_EXAMS)].includes(initialMock.examType));
          setIsCustomRole(initialMock.examRole ? !(activeCat?.roles || fallback_ROLES).includes(initialMock.examRole) : false);
          setIsCustomPlatform(initialMock.platform ? !(activeCat?.platforms || fallback_PLATFORMS).includes(initialMock.platform) : false);
          setIsCustomPhase(initialMock.examPhase ? !(activeCat?.phases || fallback_PHASES).includes(initialMock.examPhase) : false);
        } else {
          const resetData = {
            ...defaultFormData,
            ...Object.fromEntries(activeSubjects.map(s => [s.id, { score: '', percentile: '', accuracy: '' }]))
          };
          setFormData(resetData);
          setIsCustomExam(false);
          setIsCustomRole(false);
          setIsCustomPlatform(false);
          setIsCustomPhase(false);
        }
      }
    } else {
      if (!asPage) {
        document.body.style.overflow = '';
      }
      initRef.current.openedWith = null;
    }
    return () => { document.body.style.overflow = ''; };
  }, [initialMock, isOpen, asPage, categoryId, categories, defaultFormData]);

  const [selectedSection, setSelectedSection] = useState<string>(allSubjects.length > 0 ? allSubjects[0].id : 'quant');

  React.useEffect(() => {
    if (subjects.length > 0 && !subjects.find(s => s.id === selectedSection)) {
      setSelectedSection(subjects[0].id);
    }
  }, [subjects, selectedSection]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsProcessing(true);
    setError('');

    try {
      const imagesPayload: { base64: string, mimeType: string }[] = [];
      
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
             const img = new Image();
             img.onload = () => {
               const canvas = document.createElement('canvas');
               let width = img.width;
               let height = img.height;
               const maxDim = 1200; 
               if (width > maxDim || height > maxDim) {
                 if (width > height) {
                   height = Math.round((height * maxDim) / width);
                   width = maxDim;
                 } else {
                   width = Math.round((width * maxDim) / height);
                   height = maxDim;
                 }
               }
               canvas.width = width;
               canvas.height = height;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                 ctx.drawImage(img, 0, 0, width, height);
                 const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                 const result = dataUrl.split(',')[1];
                 if (result) resolve(result);
                 else reject(new Error("Failed to compress image"));
               } else {
                 const result = reader.result?.toString().split(',')[1];
                 resolve(result || '');
               }
             };
             img.onerror = () => {
                const result = reader.result?.toString().split(',')[1];
                resolve(result || '');
             };
             img.src = reader.result?.toString() || '';
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imagesPayload.push({ base64: base64Data, mimeType: 'image/jpeg' });
      }

      if (imagesPayload.length > 0) {
        const extractedData = await parseScorecardImage(imagesPayload, allSubjects);
        
        if (extractedData.examType && !EXAMS.includes(extractedData.examType)) setIsCustomExam(true);
        if (extractedData.examRole && !ROLES.includes(extractedData.examRole)) setIsCustomRole(true);

        if (extractedData.ga && (extractedData.ga.score != null || extractedData.ga.percentile != null)) {
          extractedData.examPhase = 'Mains';
        }

        if (extractedData.examScope === 'Sectional' && (extractedData as any).detectedSubject) {
          const ds = (extractedData as any).detectedSubject;
          if (allSubjects.some((s: any) => s.id === ds)) {
            setSelectedSection(ds);
          } else if (['quant', 'reasoning', 'english', 'ga', 'computer'].includes(ds)) {
            setSelectedSection(ds);
          }
        }

        setFormData((prev: any) => ({ 
          ...prev, 
          ...extractedData,
          examPhase: extractedData.examPhase || prev.examPhase,
          examScope: extractedData.examScope || prev.examScope,
          date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        }));
      }
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Memoized so SubjectRow doesn't unnecessarily re-render
  const handleSectionChange = useCallback((section: string, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.examType || !formData.mockName) {
      setError('Exam Type and Mock Name are required.');
      return;
    }

    const parseVal = (val: any) => val === '' || val === null || val === undefined ? null : Number(val);
    const parseSec = (sec: any) => ({
      score: parseVal(sec?.score),
      percentile: parseVal(sec?.percentile),
      accuracy: parseVal(sec?.accuracy)
    });

    let finalScore = parseVal(formData.score);
    let finalPercentile = parseVal(formData.percentile);
    let finalAccuracy = parseVal(formData.accuracy);
    let finalPercentage = parseVal(formData.percentage);
    
    if (formData.mockName && formData.mockName.length > 200) return setError('Mock name is too long');
    if (formData.examType && formData.examType.length > 100) return setError('Exam type string is too long');
    if (formData.platform && formData.platform.length > 100) return setError('Platform name is too long');

    if (finalPercentile !== null && (finalPercentile < 0 || finalPercentile > 100)) return setError('Percentile must be between 0 and 100');
    if (finalAccuracy !== null && (finalAccuracy < 0 || finalAccuracy > 100)) return setError('Accuracy must be between 0 and 100');
    if (finalPercentage !== null && (finalPercentage < 0 || finalPercentage > 100)) return setError('Percentage must be between 0 and 100');

    const finalDynamicSubjects: Record<string, any> = {};
    const finalTopLevelSubjects: Record<string, any> = {};

    if (formData.examScope === 'Sectional') {
      const activeSectionScore = parseVal(formData[selectedSection]?.score);
      const activeSectionPercentile = parseVal(formData[selectedSection]?.percentile);
      const activeSectionAccuracy = parseVal(formData[selectedSection]?.accuracy);
      
      finalScore = activeSectionScore; 
      finalPercentile = activeSectionPercentile;
      finalAccuracy = activeSectionAccuracy;
      
      subjects.forEach(s => {
        if (s.id === selectedSection) {
          if (['quant', 'reasoning', 'english', 'ga', 'computer'].includes(s.id)) {
            finalTopLevelSubjects[s.id] = { score: activeSectionScore, percentile: activeSectionPercentile, accuracy: activeSectionAccuracy };
          } else {
            finalDynamicSubjects[s.id] = { score: activeSectionScore, percentile: activeSectionPercentile, accuracy: activeSectionAccuracy };
          }
        } else {
          if (['quant', 'reasoning', 'english', 'ga', 'computer'].includes(s.id)) {
            finalTopLevelSubjects[s.id] = { score: null, percentile: null, accuracy: null };
          } else {
            finalDynamicSubjects[s.id] = { score: null, percentile: null, accuracy: null };
          }
        }
      });
    } else {
      subjects.forEach(s => {
        if (['quant', 'reasoning', 'english', 'ga', 'computer'].includes(s.id)) {
          finalTopLevelSubjects[s.id] = parseSec(formData[s.id]);
        } else {
          finalDynamicSubjects[s.id] = parseSec(formData[s.id]);
        }
      });
    }

    const newMock: MockScore = {
      id: formData.id || crypto.randomUUID(),
      examType: formData.examType || '',
      examRole: formData.examRole || '',
      examPhase: formData.examPhase || PHASES[0] || '',
      examScope: formData.examScope || 'Full',
      mockName: formData.mockName || '',
      platform: formData.platform || '',
      date: formData.date || new Date().toISOString().split('T')[0],
      score: finalScore,
      percentile: finalPercentile,
      percentage: finalPercentage,
      accuracy: finalAccuracy,
      ...finalTopLevelSubjects,
      dynamicSubjects: finalDynamicSubjects,
      categoryId: selectedCategory,
    };

    setIsSubmitting(true);
    try {
      await onSave(newMock);
      setFormData(defaultFormData);
      setError('');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className={`bg-slate-50 dark:bg-slate-900 ${asPage ? "w-full rounded-3xl flex flex-col shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden" : "rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"} relative z-10 font-sans`}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/60 p-5 sm:p-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          {onClose && (
            <button onClick={onClose} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {initialMock ? 'Edit Mock Score' : 'Add Mock Score'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Keep track of your performance.</p>
          </div>
        </div>
      </div>

      <div className={`${asPage ? "p-4 sm:p-6 lg:p-8" : "flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 scroll-smooth custom-scrollbar"}`}>
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* AI Upload Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">AI Scorecard Upload</h3>
            </div>
            <label className="flex flex-col items-center justify-center w-full h-36 sm:h-40 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-2xl cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 hover:border-indigo-400 transition-all bg-white dark:bg-slate-800/20 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex flex-col items-center justify-center relative z-10 py-6">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing scorecard...</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Upload Image(s)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Multi-select supported (PNG, JPG)</p>
                  </>
                )}
              </div>
              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"    
                ref={fileInputRef}
                type="file" 
                multiple
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
                disabled={isProcessing}
                autoCorrect="off" spellCheck={false}     />
            </label>
            {error && <p className="mt-2.5 text-sm text-red-500 font-medium px-2 flex items-center gap-1.5"><X className="w-4 h-4"/> {error}</p>}
          </section>

          {/* Details Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Exam Details</h3>
            </div>
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm space-y-5">
              
              {categories && categories.length > 0 && (
                <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
                  <CustomDropdown
                    value={categories.find(c => c.id === selectedCategory)?.name || ""}
                    options={categories.map(c => c.name)}
                    placeholder="Select Category"
                    onChange={(val) => {
                       const selectedCat = categories.find(c => c.name === val);
                       if (selectedCat) {
                           setSelectedCategory(selectedCat.id);
                           const activeSubjects = selectedCat?.subjects && selectedCat.subjects.length > 0 ? selectedCat.subjects : [
                             { id: 'quant', name: 'Quant' },
                             { id: 'reasoning', name: 'Reasoning' },
                             { id: 'english', name: 'English' },
                             { id: 'ga', name: 'GA' }
                           ];
                           
                           setIsCustomExam(false);
                           setIsCustomRole(false);
                           setIsCustomPhase(false);
                           setIsCustomPlatform(false);
                           
                           setFormData((prev: any) => ({
                             ...prev,
                             examType: '',
                             examRole: '',
                             examPhase: (selectedCat?.phases && selectedCat.phases.includes('Prelims')) ? 'Prelims' : (selectedCat?.phases?.[0] || ''),
                             platform: '',
                             ...Object.fromEntries(activeSubjects.map(s => [s.id, prev[s.id] || { score: '', percentile: '', accuracy: '' }]))
                           }));
                       }
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Exam</label>
                      {!isCustomExam ? (
                        <CustomDropdown
                          value={formData.examType || ""}
                          placeholder="Select Exam"
                          options={EXAMS}
                          allowCustom
                          required
                          onChange={(val) => {
                            if (val === "Other") {
                              setIsCustomExam(true);
                              setFormData((p: any) => ({ ...p, examType: "" }));
                            } else {
                              setFormData((p: any) => ({ ...p, examType: val }));
                            }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" type="text"
                            value={formData.examType ?? ''}
                            onChange={e => setFormData({ ...formData, examType: e.target.value })}
                            placeholder="Custom Exam..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            autoFocus
                            required
                          />
                          <button type="button" onClick={() => { setIsCustomExam(false); setFormData((p: any) => ({ ...p, examType: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Role</label>
                      {!isCustomRole ? (
                        <CustomDropdown
                          value={formData.examRole || ""}
                          placeholder="Select Role"
                          options={ROLES}
                          allowCustom
                          onChange={(val) => {
                            if (val === "Other") {
                              setIsCustomRole(true);
                              setFormData((p: any) => ({ ...p, examRole: "" }));
                            } else {
                              setFormData((p: any) => ({ ...p, examRole: val }));
                            }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" type="text"
                            value={formData.examRole ?? ''}
                            onChange={e => setFormData({ ...formData, examRole: e.target.value })}
                            placeholder="Custom Role..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            autoFocus
                          />
                          <button type="button" onClick={() => { setIsCustomRole(false); setFormData((p: any) => ({ ...p, examRole: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Mock Title</label>
                    <textarea
                      value={formData.mockName ?? ''}
                      onChange={(e) => setFormData({...formData, mockName: e.target.value})}
                      placeholder="e.g. Mock Test 1"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none overflow-hidden"
                      rows={1}
                      required
                      autoCorrect="off" spellCheck={false}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Phase</label>
                      {!isCustomPhase ? (
                        <CustomDropdown
                          value={formData.examPhase || (PHASES && PHASES.includes('Prelims') ? 'Prelims' : (PHASES[0] || ''))}
                          placeholder="Select Phase"
                          options={PHASES}
                          allowCustom
                          onChange={(val) => {
                            if (val === 'Other') {
                              setIsCustomPhase(true);
                              setFormData((p: any) => ({ ...p, examPhase: '' }));
                            } else {
                              setFormData((p: any) => ({ ...p, examPhase: val }));
                            }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" type="text"
                            value={formData.examPhase ?? ''}
                            onChange={e => setFormData({ ...formData, examPhase: e.target.value })}
                            placeholder="Custom Phase..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            autoFocus
                          />
                          <button type="button" onClick={() => { setIsCustomPhase(false); setFormData((p: any) => ({ ...p, examPhase: PHASES[0] || "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Scope</label>
                      <CustomDropdown
                        value={formData.examScope || 'Full'}
                        placeholder="Select Scope"
                        options={SCOPES}
                        onChange={(val) => {
                          setFormData((p: any) => ({ ...p, examScope: val }));
                          if (val === 'Sectional' && subjects.length > 0) {
                            setSelectedSection(subjects[0].id as any);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Platform</label>
                      {!isCustomPlatform ? (
                        <CustomDropdown
                          value={formData.platform || ''}
                          placeholder="Platform"
                          options={PLATFORMS}
                          allowCustom
                          onChange={(val) => {
                            if (val === 'Other') {
                              setIsCustomPlatform(true);
                              setFormData((p: any) => ({ ...p, platform: '' }));
                            } else {
                              setFormData((p: any) => ({ ...p, platform: val }));
                            }
                          }}
                        />
                      ) : (
                        <div className="relative">
                          <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" type="text"
                            value={formData.platform ?? ''}
                            onChange={e => setFormData({ ...formData, platform: e.target.value })}
                            placeholder="Custom Platform..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            autoFocus
                          />
                          <button type="button" onClick={() => { setIsCustomPlatform(false); setFormData((p: any) => ({ ...p, platform: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Date</label>
                      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                        type="datetime-local"
                        name="date"
                        value={formData.date ?? ''}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm text-slate-800 dark:text-slate-200"
                        autoCorrect="off" spellCheck={false}     />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Performance Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Metrics & Performance</h3>
            </div>
            
            {formData.examScope === 'Sectional' ? (
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-7 shadow-sm">
                 <div className="mb-6 flex flex-wrap gap-2">
                   {subjects.map((s, idx) => {
                     const isSelected = selectedSection === s.id;
                     return (
                       <button 
                         key={s.id} 
                         type="button" 
                         onClick={() => setSelectedSection(s.id)} 
                         className={`px-5 py-2 rounded-xl font-medium text-sm transition-all shadow-sm
                         ${isSelected ? 'bg-indigo-500 text-white shadow-indigo-200 dark:shadow-none translate-y-[-2px]' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700'}`}
                       >
                         {s.name}
                       </button>
                     );
                   })}
                 </div>
                 
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-5 sm:p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700 inset-shadow-sm">
                   <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-5 pb-3 border-b border-slate-200 dark:border-slate-800/50 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      {subjects.find(s => s.id === selectedSection)?.name} Summary
                   </h4>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                        <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Score</label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                          type="search" inputMode="decimal" step="0.01"
                          value={formData[selectedSection]?.score ?? ''}
                          onChange={e => handleSectionChange(selectedSection, 'score', e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-medium dark:text-slate-100 shadow-sm transition-shadow hover:shadow-md"
                        />
                      </div>
                      <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                        <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Percentile</label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                          type="search" inputMode="decimal" step="0.01"
                          value={formData[selectedSection]?.percentile ?? ''}
                          onChange={e => handleSectionChange(selectedSection, 'percentile', e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-medium dark:text-slate-100 shadow-sm transition-shadow hover:shadow-md"
                        />
                      </div>
                      <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                        <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Accuracy %</label>
                        <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                          type="search" inputMode="decimal" step="0.01"
                          value={(formData as any)[selectedSection]?.accuracy ?? ''}
                          onChange={e => handleSectionChange(selectedSection, 'accuracy', e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-medium dark:text-slate-100 shadow-sm transition-shadow hover:shadow-md"
                        />
                      </div>
                   </div>
                 </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Overall Performance */}
                <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-500">
                    <Activity className="w-32 h-32" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 inline-flex items-center gap-2 relative z-10">
                    <BarChart3 className="w-4 h-4 text-slate-500" /> Overall Performance
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5 relative z-10">
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Score</label>
                      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                        type="search" inputMode="decimal" step="0.01"
                        name="score"
                        value={formData.score ?? ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-semibold dark:text-slate-100 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                        required
                        autoCorrect="off" spellCheck={false}     />
                    </div>
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Percentile</label>
                      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                        type="search" inputMode="decimal" step="0.01"
                        name="percentile"
                        value={formData.percentile ?? ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-semibold dark:text-slate-100 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                        autoCorrect="off" spellCheck={false}     />
                    </div>
                    <div className="space-y-1.5 focus-within:relative focus-within:z-10">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Accuracy %</label>
                      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other"   
                        type="search" inputMode="decimal" step="0.01"
                        name="accuracy"
                        value={formData.accuracy ?? ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-base font-semibold dark:text-slate-100 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                        autoCorrect="off" spellCheck={false}     />
                    </div>
                  </div>
                </div>

                {/* Sectional Breakdown */}
                {subjects.length > 0 && (
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-6 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/50 inline-flex items-center gap-2">
                       <Calculator className="w-4 h-4 text-slate-400" /> Sectional Breakdown 
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      {subjects.map(sub => (
                        <SubjectRow 
                          key={sub.id} 
                          sub={sub} 
                          data={formData[sub.id]} 
                          onChange={handleSectionChange} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800/60 p-5 sm:p-6 flex justify-end gap-3 z-10 shrink-0">
        <button 
          type="button" 
          onClick={onClose}
          disabled={isSubmitting}
          className="px-6 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-w-[100px] neon-action-btn"
        >
          Cancel
        </button>
        <button 
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-8 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 shadow-sm hover:shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center justify-center min-w-[140px] neon-action-btn"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
          ) : (initialMock?.id ? 'Update Score' : 'Save Score')}
        </button>
      </div>
    </div>
  );

  if (asPage) return content;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, transition: { duration: 0.15 } }} 
            className="absolute inset-0 bg-slate-900/60" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.1, duration: 0.4 } }} 
            exit={{ opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.15 } }} 
            className="w-full max-w-5xl flex flex-col relative z-10 max-h-[92vh] sm:max-h-[95vh]"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
