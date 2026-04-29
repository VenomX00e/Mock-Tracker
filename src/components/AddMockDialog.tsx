import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MockScore } from '../types';
import { parseScorecardImage } from '../services/geminiService';
import { X, Upload, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { CustomDropdown } from './CustomDropdown';

import { EXAMS, ROLES, PHASES, SCOPES, PLATFORMS } from '../lib/constants';

interface AddMockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mock: MockScore) => void;
  initialMock?: MockScore;
}

export default function AddMockDialog({ isOpen, onClose, onSave, initialMock }: AddMockDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);

  const defaultFormData = {
    examType: '',
    examRole: '',
    examPhase: 'Prelims',
    examScope: 'Full',
    mockName: '',
    platform: '',
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    score: '',
    percentile: '',
    percentage: '',
    accuracy: '',
    quant: { score: '', percentile: '', accuracy: '' },
    reasoning: { score: '', percentile: '', accuracy: '' },
    english: { score: '', percentile: '', accuracy: '' },
    ga: { score: '', percentile: '', accuracy: '' },
  };

  const [formData, setFormData] = useState<any>(defaultFormData);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (initialMock) {
        setFormData({ ...defaultFormData, ...initialMock });
        setIsCustomExam(!['', 'Live Mock', ...EXAMS].includes(initialMock.examType));
        setIsCustomRole(initialMock.examRole ? !ROLES.includes(initialMock.examRole) : false);
        setIsCustomPlatform(initialMock.platform ? !PLATFORMS.includes(initialMock.platform) : false);
        setIsCustomPhase(initialMock.examPhase ? !PHASES.includes(initialMock.examPhase) : false);
      } else {
        setFormData(defaultFormData);
        setIsCustomExam(false);
        setIsCustomRole(false);
        setIsCustomPlatform(false);
        setIsCustomPhase(false);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [initialMock, isOpen]);

  const [selectedSection, setSelectedSection] = useState<'quant'|'reasoning'|'english'|'ga'>('quant');

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
             const result = reader.result?.toString().split(',')[1];
             if (result) resolve(result);
             else reject(new Error("Failed to read file"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imagesPayload.push({ base64: base64Data, mimeType: file.type });
      }

      if (imagesPayload.length > 0) {
        const extractedData = await parseScorecardImage(imagesPayload);
        
        // Auto-detect custom exam type/role if not in predefined list
        if (extractedData.examType && !EXAMS.includes(extractedData.examType)) setIsCustomExam(true);
        if (extractedData.examRole && !ROLES.includes(extractedData.examRole)) setIsCustomRole(true);

        if (extractedData.examScope === 'Sectional' && (extractedData as any).detectedSubject) {
          if (['quant', 'reasoning', 'english', 'ga'].includes((extractedData as any).detectedSubject)) {
            setSelectedSection((extractedData as any).detectedSubject);
          }
        }

        setFormData((prev: any) => ({ 
          ...prev, 
          ...extractedData,
          examPhase: extractedData.examPhase || prev.examPhase,
          examScope: extractedData.examScope || prev.examScope
        }));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process images');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, section?: 'quant' | 'reasoning' | 'english' | 'ga', field?: 'score' | 'percentile' | 'accuracy') => {
    const { name, value } = e.target;
    
    if (section && field) {
      setFormData((prev: any) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
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
    
    let finalQuant = parseSec(formData.quant);
    let finalReasoning = parseSec(formData.reasoning);
    let finalEnglish = parseSec(formData.english);
    let finalGa = formData.examPhase === 'Mains' ? parseSec(formData.ga) : { score: null, percentile: null, accuracy: null };

    if (formData.examScope === 'Sectional') {
      const activeSectionScore = parseVal(formData[selectedSection]?.score);
      const activeSectionPercentile = parseVal(formData[selectedSection]?.percentile);
      const activeSectionAccuracy = parseVal(formData[selectedSection]?.accuracy);
      
      finalScore = activeSectionScore; // Sync with overall score for charts
      finalPercentile = activeSectionPercentile;
      finalAccuracy = activeSectionAccuracy;
      
      // Clear other sections and only set the chosen one
      finalQuant = { score: null, percentile: null, accuracy: null };
      finalReasoning = { score: null, percentile: null, accuracy: null };
      finalEnglish = { score: null, percentile: null, accuracy: null };
      finalGa = { score: null, percentile: null, accuracy: null };
      
      if (selectedSection === 'quant') finalQuant = { score: activeSectionScore, percentile: activeSectionPercentile, accuracy: activeSectionAccuracy };
      if (selectedSection === 'reasoning') finalReasoning = { score: activeSectionScore, percentile: activeSectionPercentile, accuracy: activeSectionAccuracy };
      if (selectedSection === 'english') finalEnglish = { score: activeSectionScore, percentile: activeSectionPercentile, accuracy: activeSectionAccuracy };
      if (selectedSection === 'ga') finalGa = { score: activeSectionScore, percentile: activeSectionPercentile, accuracy: activeSectionAccuracy };
    }

    const newMock: MockScore = {
      id: formData.id || crypto.randomUUID(),
      examType: formData.examType || '',
      examRole: formData.examRole || '',
      examPhase: formData.examPhase || 'Prelims',
      examScope: formData.examScope || 'Full',
      mockName: formData.mockName || '',
      platform: formData.platform || '',
      date: formData.date || new Date().toISOString().split('T')[0],
      score: finalScore,
      percentile: finalPercentile,
      percentage: finalPercentage,
      accuracy: finalAccuracy,
      quant: finalQuant,
      reasoning: finalReasoning,
      english: finalEnglish,
      ga: finalGa,
    };

    onSave(newMock);
    
    // Reset form
    setFormData(defaultFormData);
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 relative z-10"
          >
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{initialMock ? 'Edit Mock Score' : 'Add Mock Score'}</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 dark:border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">Analyzing scorecard with AI...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-indigo-400 dark:text-indigo-500 mb-2" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload Scorecard Image(s)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Multi-select supported (PNG, JPG)</p>
                  </>
                )}
              </div>
              <input autoComplete="off"    
                ref={fileInputRef}
                type="file" 
                multiple
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </label>
            {error && <p className="mt-3 text-sm text-red-500 font-medium">{error}</p>}
          </div>

          <div id="mock-form" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Exam Header</label>
                <div className="grid grid-cols-2 gap-3">
                  {!isCustomExam ? (
                    <CustomDropdown
                      value={formData.examType || ""}
                      placeholder="Exam"
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
                      <input autoComplete="off"    type="search"
                        value={formData.examType ?? ''}
onChange={e => setFormData(p => ({...p, examType: e.target.value}))}
                        placeholder="Custom Exam..."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        autoFocus
                        required
                      />
                      <button type="button" onClick={() => { setIsCustomExam(false); setFormData((p: any) => ({ ...p, examType: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  {!isCustomRole ? (
                    <CustomDropdown
                      value={formData.examRole || ""}
                      placeholder="Role"
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
                      <input autoComplete="off"    type="search"
                        value={formData.examRole ?? ''}
onChange={e => setFormData(p => ({...p, examRole: e.target.value}))}
                        placeholder="Custom Role..."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        autoFocus
                      />
                      <button type="button" onClick={() => { setIsCustomRole(false); setFormData((p: any) => ({ ...p, examRole: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2 flex flex-col justify-end">
                <div className="grid grid-cols-2 gap-3">
                  {!isCustomPhase ? (
                    <CustomDropdown
                      value={formData.examPhase || 'Prelims'}
                      placeholder="Phase"
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
                      <input autoComplete="off"    type="search"
                        value={formData.examPhase ?? ''}
onChange={e => setFormData(p => ({...p, examPhase: e.target.value}))}
                        placeholder="Custom Phase..."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        autoFocus
                      />
                      <button type="button" onClick={() => { setIsCustomPhase(false); setFormData((p: any) => ({ ...p, examPhase: "Prelims" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  <CustomDropdown
                    value={formData.examScope || 'Full'}
                    placeholder="Scope"
                    options={SCOPES}
                    onChange={(val) => setFormData((p: any) => ({ ...p, examScope: val }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mock Name</label>
                <input autoComplete="off"    type="search"
                  value={formData.mockName ?? ''}
onChange={e => setFormData(p => ({...p, mockName: e.target.value}))}
                  placeholder="Mock Name"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  required
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform</label>
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
                    <input autoComplete="off"    type="search"
                      value={formData.platform ?? ''}
onChange={e => setFormData(p => ({...p, platform: e.target.value}))}
                      placeholder="Custom Platform..."
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 pr-8 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      autoFocus
                    />
                    <button type="button" onClick={() => { setIsCustomPlatform(false); setFormData((p: any) => ({ ...p, platform: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date & Time</label>
                <input autoComplete="off"   
                  type="datetime-local"
                  value={formData.date ?? ''}
onChange={e => setFormData(p => ({...p, date: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {formData.examScope === 'Sectional' ? (
              <div className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 mt-6 relative pb-16">
                <div className="absolute -top-4 w-full left-0 flex justify-center mt-[-10px]">
                   <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700/50 rounded-lg p-1 gap-1">
                     <button type="button" onClick={() => setSelectedSection('quant')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'quant' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Q</button>
                     <button type="button" onClick={() => setSelectedSection('reasoning')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'reasoning' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>R</button>
                     <button type="button" onClick={() => setSelectedSection('english')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'english' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>E</button>
                     <button type="button" onClick={() => setSelectedSection('ga')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'ga' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>GA</button>
                   </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-4 capitalize">{selectedSection} Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Score</label>
                    <input autoComplete="off"   
                      type="search" inputMode="decimal"
                      step="0.01"
                      
                      value={formData[selectedSection]?.score}
                      onChange={e => handleInputChange(e, selectedSection, 'score')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentile</label>
                    <input autoComplete="off"   
                      type="search" inputMode="decimal"
                      step="0.01"
                      
                      value={formData[selectedSection]?.percentile}
                      onChange={e => handleInputChange(e, selectedSection, 'percentile')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Accuracy%</label>
                    <input autoComplete="off"   
                      type="search" inputMode="decimal"
                      step="0.01"
                      
                      value={(formData as any)[selectedSection]?.accuracy ?? ''}
                      onChange={e => handleInputChange(e, selectedSection, 'accuracy')}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 inline-flex items-center">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                    Overall Performance
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</label>
                      <input autoComplete="off"   
                        type="search" inputMode="decimal"
                        step="0.01"
                        value={formData.score ?? ''}
onChange={e => setFormData(p => ({...p, score: e.target.value}))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm dark:text-slate-100"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Percentile</label>
                      <input autoComplete="off"   
                        type="search" inputMode="decimal"
                        step="0.01"
                        value={formData.percentile ?? ''}
onChange={e => setFormData(p => ({...p, percentile: e.target.value}))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm dark:text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accuracy %</label>
                      <input autoComplete="off"   
                        type="search" inputMode="decimal"
                        step="0.01"
                        value={formData.accuracy ?? ''}
onChange={e => setFormData(p => ({...p, accuracy: e.target.value}))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                    Sectional breakdown
                  </h3>
                  
                  {/* Quant */}
                  <div className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="w-24 font-medium text-sm text-slate-700 dark:text-slate-300">Quant</div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Score"
                          value={formData.quant?.score ?? ''}
                          onChange={(e) => handleInputChange(e, 'quant', 'score')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Percentile"
                          value={formData.quant?.percentile ?? ''}
                          onChange={(e) => handleInputChange(e, 'quant', 'percentile')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Accuracy"
                          value={formData.quant?.accuracy ?? ''}
                          onChange={(e) => handleInputChange(e, 'quant', 'accuracy')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                   {/* Reasoning */}
                   <div className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="w-24 font-medium text-sm text-slate-700 dark:text-slate-300">Reasoning</div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Score"
                          value={formData.reasoning?.score ?? ''}
                          onChange={(e) => handleInputChange(e, 'reasoning', 'score')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Percentile"
                          value={formData.reasoning?.percentile ?? ''}
                          onChange={(e) => handleInputChange(e, 'reasoning', 'percentile')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Accuracy"
                          value={formData.reasoning?.accuracy ?? ''}
                          onChange={(e) => handleInputChange(e, 'reasoning', 'accuracy')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                   {/* English */}
                   <div className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="w-24 font-medium text-sm text-slate-700 dark:text-slate-300">English</div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Score"
                          value={formData.english?.score ?? ''}
                          onChange={(e) => handleInputChange(e, 'english', 'score')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Percentile"
                          value={formData.english?.percentile ?? ''}
                          onChange={(e) => handleInputChange(e, 'english', 'percentile')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <input autoComplete="off"   
                          type="search" inputMode="decimal" step="0.01"
                          placeholder="Accuracy"
                          value={formData.english?.accuracy ?? ''}
                          onChange={(e) => handleInputChange(e, 'english', 'accuracy')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                   {/* GA */}
                   {formData.examPhase !== 'Prelims' && (
                     <div className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                      <div className="w-24 font-medium text-sm text-slate-700 dark:text-slate-300">GA</div>
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                           <input autoComplete="off"   
                            type="search" inputMode="decimal" step="0.01"
                            placeholder="Score"
                            value={formData.ga?.score ?? ''}
                            onChange={(e) => handleInputChange(e, 'ga', 'score')}
                            className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                        <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                           <input autoComplete="off"   
                            type="search" inputMode="decimal" step="0.01"
                            placeholder="Percentile"
                            value={formData.ga?.percentile ?? ''}
                            onChange={(e) => handleInputChange(e, 'ga', 'percentile')}
                            className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                        <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                           <input autoComplete="off"   
                            type="search" inputMode="decimal" step="0.01"
                            placeholder="Accuracy"
                            value={formData.ga?.accuracy ?? ''}
                            onChange={(e) => handleInputChange(e, 'ga', 'accuracy')}
                            className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          />
                        </div>
                      </div>
                    </div>
                   )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-6 flex justify-end gap-3 rounded-b-2xl">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700 focus:ring-offset-2 transition-all"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            {initialMock?.id ? 'Update Score' : 'Save Score'}
          </button>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
