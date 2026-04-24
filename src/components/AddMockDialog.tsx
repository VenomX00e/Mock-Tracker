import React, { useState, useRef } from 'react';
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
    if (initialMock && isOpen) {
      setFormData({ ...defaultFormData, ...initialMock });
      setIsCustomExam(!['', 'Live Mock', ...EXAMS].includes(initialMock.examType));
      setIsCustomRole(initialMock.examRole ? !ROLES.includes(initialMock.examRole) : false);
      setIsCustomPlatform(initialMock.platform ? !PLATFORMS.includes(initialMock.platform) : false);
      setIsCustomPhase(initialMock.examPhase ? !PHASES.includes(initialMock.examPhase) : false);
    } else if (isOpen) {
      setFormData(defaultFormData);
      setIsCustomExam(false);
      setIsCustomRole(false);
      setIsCustomPlatform(false);
      setIsCustomPhase(false);
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10 rounded-t-2xl">
          <h2 className="text-xl font-semibold text-gray-900">Add Mock Score</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-8">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-slate-50/50">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-sm text-slate-600">Analyzing scorecard with AI...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-indigo-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">Upload Scorecard Image(s)</p>
                    <p className="text-xs text-slate-500 mt-1">Multi-select supported (PNG, JPG)</p>
                  </>
                )}
              </div>
              <input 
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

          <form id="mock-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-800">Exam Header</label>
                <div className="grid grid-cols-2 gap-3">
                  {!isCustomExam ? (
                    <CustomDropdown
                      value={formData.examType || ""}
                      placeholder="Exam (e.g. SBI)"
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
                      <input
                        type="text"
                        name="examType"
                        value={formData.examType}
                        onChange={handleInputChange}
                        placeholder="Custom Exam..."
                        className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 pr-8 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                        autoFocus
                        required
                      />
                      <button type="button" onClick={() => { setIsCustomExam(false); setFormData((p: any) => ({ ...p, examType: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  {!isCustomRole ? (
                    <CustomDropdown
                      value={formData.examRole || ""}
                      placeholder="Role (e.g. PO)"
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
                      <input
                        type="text"
                        name="examRole"
                        value={formData.examRole || ''}
                        onChange={handleInputChange}
                        placeholder="Custom Role..."
                        className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 pr-8 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
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
                      <input
                        type="text"
                        name="examPhase"
                        value={formData.examPhase}
                        onChange={handleInputChange}
                        placeholder="Custom Phase..."
                        className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 pr-8 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Mock Name</label>
                <input
                  type="text"
                  name="mockName"
                  value={formData.mockName}
                  onChange={handleInputChange}
                  placeholder="e.g. Mock Test 1"
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Platform</label>
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
                    <input
                      type="text"
                      name="platform"
                      value={formData.platform}
                      onChange={handleInputChange}
                      placeholder="Custom Platform..."
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 pr-8 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                      autoFocus
                    />
                    <button type="button" onClick={() => { setIsCustomPlatform(false); setFormData((p: any) => ({ ...p, platform: "" })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {formData.examScope === 'Sectional' ? (
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 mt-6 relative pb-16">
                <div className="absolute -top-4 w-full left-0 flex justify-center mt-[-10px]">
                   <div className="flex bg-white shadow-sm border border-slate-200 rounded-lg p-1 gap-1">
                     <button type="button" onClick={() => setSelectedSection('quant')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'quant' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>Q</button>
                     <button type="button" onClick={() => setSelectedSection('reasoning')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'reasoning' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>R</button>
                     <button type="button" onClick={() => setSelectedSection('english')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'english' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}>E</button>
                     <button type="button" onClick={() => setSelectedSection('ga')} className={`px-4 py-1.5 rounded-md font-medium text-sm transition-colors ${selectedSection === 'ga' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>GA</button>
                   </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mt-6 mb-4 capitalize">{selectedSection} Performance</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Score</label>
                    <input
                      type="number"
                      step="0.01"
                      name="score"
                      value={formData[selectedSection]?.score}
                      onChange={e => handleInputChange(e, selectedSection, 'score')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentile</label>
                    <input
                      type="number"
                      step="0.01"
                      name="percentile"
                      value={formData[selectedSection]?.percentile}
                      onChange={e => handleInputChange(e, selectedSection, 'percentile')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentage</label>
                    <input
                      type="number"
                      step="0.01"
                      name="percentage"
                      value={formData.percentage}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Accuracy%</label>
                    <input
                      type="number"
                      step="0.01"
                      name="accuracy"
                      value={formData[selectedSection]?.accuracy}
                      onChange={e => handleInputChange(e, selectedSection, 'accuracy')}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 inline-flex items-center">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                    Overall Performance
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Score</label>
                      <input
                        type="number"
                        step="0.01"
                        name="score"
                        value={formData.score ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentile</label>
                      <input
                        type="number"
                        step="0.01"
                        name="percentile"
                        value={formData.percentile ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentage</label>
                      <input
                        type="number"
                        step="0.01"
                        name="percentage"
                        value={formData.percentage ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Accuracy %</label>
                      <input
                        type="number"
                        step="0.01"
                        name="accuracy"
                        value={formData.accuracy ?? ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 inline-flex items-center">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full mr-2"></span>
                    Sectional breakdown
                  </h3>
                  
                  {/* Quant */}
                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="w-24 font-medium text-sm text-slate-700">Quant</div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">Score</span>
                         <input
                          type="number" step="0.01"
                          value={formData.quant?.score ?? ''}
                          onChange={(e) => handleInputChange(e, 'quant', 'score')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">%ile</span>
                         <input
                          type="number" step="0.01"
                          value={formData.quant?.percentile ?? ''}
                          onChange={(e) => handleInputChange(e, 'quant', 'percentile')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">Acc%</span>
                         <input
                          type="number" step="0.01"
                          value={formData.quant?.accuracy ?? ''}
                          onChange={(e) => handleInputChange(e, 'quant', 'accuracy')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                   {/* Reasoning */}
                   <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="w-24 font-medium text-sm text-slate-700">Reasoning</div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">Score</span>
                         <input
                          type="number" step="0.01"
                          value={formData.reasoning?.score ?? ''}
                          onChange={(e) => handleInputChange(e, 'reasoning', 'score')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">%ile</span>
                         <input
                          type="number" step="0.01"
                          value={formData.reasoning?.percentile ?? ''}
                          onChange={(e) => handleInputChange(e, 'reasoning', 'percentile')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">Acc%</span>
                         <input
                          type="number" step="0.01"
                          value={formData.reasoning?.accuracy ?? ''}
                          onChange={(e) => handleInputChange(e, 'reasoning', 'accuracy')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                   {/* English */}
                   <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                    <div className="w-24 font-medium text-sm text-slate-700">English</div>
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">Score</span>
                         <input
                          type="number" step="0.01"
                          value={formData.english?.score ?? ''}
                          onChange={(e) => handleInputChange(e, 'english', 'score')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">%ile</span>
                         <input
                          type="number" step="0.01"
                          value={formData.english?.percentile ?? ''}
                          onChange={(e) => handleInputChange(e, 'english', 'percentile')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                         <span className="px-2 text-[10px] text-slate-500 font-medium">Acc%</span>
                         <input
                          type="number" step="0.01"
                          value={formData.english?.accuracy ?? ''}
                          onChange={(e) => handleInputChange(e, 'english', 'accuracy')}
                          className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                        />
                      </div>
                    </div>
                  </div>

                   {/* GA */}
                   {formData.examPhase !== 'Prelims' && (
                     <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                      <div className="w-24 font-medium text-sm text-slate-700">GA</div>
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                           <span className="px-2 text-[10px] text-slate-500 font-medium">Score</span>
                           <input
                            type="number" step="0.01"
                            value={formData.ga?.score ?? ''}
                            onChange={(e) => handleInputChange(e, 'ga', 'score')}
                            className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                          />
                        </div>
                        <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                           <span className="px-2 text-[10px] text-slate-500 font-medium">%ile</span>
                           <input
                            type="number" step="0.01"
                            value={formData.ga?.percentile ?? ''}
                            onChange={(e) => handleInputChange(e, 'ga', 'percentile')}
                            className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                          />
                        </div>
                        <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                           <span className="px-2 text-[10px] text-slate-500 font-medium">Acc%</span>
                           <input
                            type="number" step="0.01"
                            value={formData.ga?.accuracy ?? ''}
                            onChange={(e) => handleInputChange(e, 'ga', 'accuracy')}
                            className="w-full p-2 bg-transparent focus:outline-none font-mono text-sm"
                          />
                        </div>
                      </div>
                    </div>
                   )}
                </div>
              </>
            )}
          </form>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex justify-end gap-3 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="mock-form"
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            {initialMock?.id ? 'Update Score' : 'Save Score'}
          </button>
        </div>
      </div>
    </div>
  );
}
