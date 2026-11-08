import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MockScore, ExamCategory } from '../types';
import { parseScorecardImage } from '../services/geminiService';
import { X, Loader2, ArrowLeft, Settings } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { usePublicSettingsCtx } from '../context/AppContext';
import { jarvisEventBus, JarvisActionEvent } from '../features/jarvis/utils/eventBus';
import { useGeminiResolution } from '../hooks/useGeminiResolution';

import { EXAMS as fallback_EXAMS, ROLES as fallback_ROLES, PHASES as fallback_PHASES, PLATFORMS as fallback_PLATFORMS } from '../lib/constants';
import { getErrorMessage } from '../lib/errorUtils';
import { compressScorecardImages, ScorecardUploadSection } from './mocks/ScorecardUploadSection';
import { MockPerformanceSection } from './mocks/MockPerformanceSection';

interface AddMockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mock: MockScore) => void;
  initialMock?: MockScore;
  categories?: ExamCategory[];
  categoryId?: string;
  asPage?: boolean;
}

export default function AddMockDialog({ isOpen, onClose, onSave, initialMock, categories, categoryId, asPage = false }: AddMockDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mockExtractionModel } = usePublicSettingsCtx();

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

  const { isFeatureAllowed, isModelLocked, activeModel } = useGeminiResolution('mock_score_extractor');
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

          setFormData((prev: any) => ({ 
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

  useEffect(() => {
    const handleJarvisEvent = (action: JarvisActionEvent) => {
      if (action.type === 'EXECUTE_INTENT') {
        const payload = action.payload || {};
        if (action.intent === 'ADD_MOCK_SCORE' || action.intent === 'FILL_MOCK_SCORE') {
          if (payload && typeof payload === 'object') {
            setFormData((prev: any) => ({
              ...prev,
              ...payload,
            }));
          }
        }
      }
    };

    const unsubscribe = jarvisEventBus.subscribe(handleJarvisEvent);
    return () => unsubscribe();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (!isFeatureAllowed) {
      setError('An API Key is required for Mock Exam Generator. Please add your Gemini key in Settings or request access from your Administrator.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const imagesPayload = await compressScorecardImages(files);

      if (imagesPayload.length > 0) {
        const extractedData = await parseScorecardImage(imagesPayload, allSubjects, activeModel);
        
        setIsCustomExam(Boolean(extractedData.examType && !EXAMS.includes(extractedData.examType)));
        setIsCustomRole(Boolean(extractedData.examRole && !ROLES.includes(extractedData.examRole)));

        if (
          (extractedData.ga && (extractedData.ga.score != null || extractedData.ga.percentile != null || extractedData.ga.accuracy != null)) ||
          ((extractedData as any).computer && ((extractedData as any).computer.score != null || (extractedData as any).computer.percentile != null))
        ) {
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
          <ScorecardUploadSection
            activeModel={activeModel}
            isModelLocked={isModelLocked}
            isFeatureAllowed={isFeatureAllowed}
            isProcessing={isProcessing}
            error={error}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
          />

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
          <MockPerformanceSection
            formData={formData}
            subjects={subjects}
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
            handleChange={handleChange}
            handleSectionChange={handleSectionChange}
          />

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
