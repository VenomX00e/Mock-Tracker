import React, { useState } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { CustomDropdown } from './CustomDropdown';
import { EXAMS, ROLES, PHASES, SCOPES, PLATFORMS } from '../lib/constants';
import { parseMockAnnouncementImage } from '../services/geminiService';
import { X, Save, FileText, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../services/AuthContext';

interface AddLiveMockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddLiveMockDialog({ isOpen, onClose, onSuccess }: AddLiveMockDialogProps) {
  const { user } = useAuth();
  const [liveMockData, setLiveMockData] = useState({
    examType: '',
    examRole: '',
    examPhase: 'Prelims',
    examScope: 'Full',
    mockName: '',
    platform: '',
    date: '',
  });

  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsProcessingImage(true);
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
        const extractedData = await parseMockAnnouncementImage(imagesPayload);
        
        if (extractedData.examType && !EXAMS.includes(extractedData.examType)) setIsCustomExam(true);
        if (extractedData.examRole && !ROLES.includes(extractedData.examRole)) setIsCustomRole(true);
        if (extractedData.examPhase && !PHASES.includes(extractedData.examPhase)) setIsCustomPhase(true);
        if (extractedData.platform && !PLATFORMS.includes(extractedData.platform)) setIsCustomPlatform(true);

        setLiveMockData((prev) => ({ 
          ...prev, 
          ...extractedData,
          examPhase: extractedData.examPhase || prev.examPhase,
          examScope: extractedData.examScope || prev.examScope
        }));
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to process images');
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  const saveLiveMock = async () => {
    setSavingAnnouncement(true);
    try {
      if (!liveMockData.mockName || !liveMockData.examType) {
        alert("Mock Name and Exam Type are required.");
        setSavingAnnouncement(false);
        return;
      }
      if (!user?.uid) {
        alert("User not authenticated.");
        setSavingAnnouncement(false);
        return;
      }

      const newId = `liveMock_${Date.now()}`;
      await setDoc(doc(db, 'system', newId), {
        type: 'liveMock',
        createdBy: user.uid,
        ...liveMockData,
        title: `Live: ${liveMockData.mockName}`,
        description: `Join the community in taking the ${liveMockData.examType} ${liveMockData.examRole} ${liveMockData.examPhase} mock on ${liveMockData.platform || 'any platform'}.`,
        link: '',
        updatedAt: new Date().toISOString()
      }, { merge: false });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving live mock", error);
      alert("Failed to save live mock");
    }
    setSavingAnnouncement(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Host Live Mock</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl relative overflow-hidden group">
            <input type="file" multiple accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              {isProcessingImage ? <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Auto-fill with AI</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upload mock announcement image</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Exam Type*</label>
              <CustomDropdown options={EXAMS} value={liveMockData.examType} onChange={(v) => setLiveMockData({ ...liveMockData, examType: v })} placeholder="E.g. SBI PO" allowCustom={true} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Target Role</label>
              <CustomDropdown options={ROLES} value={liveMockData.examRole} onChange={(v) => setLiveMockData({ ...liveMockData, examRole: v })} placeholder="E.g. PO, Clerk" allowCustom={true} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Phase</label>
              <CustomDropdown options={PHASES} value={liveMockData.examPhase} onChange={(v) => setLiveMockData({ ...liveMockData, examPhase: v })} placeholder="E.g. Prelims" allowCustom={true} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Scope</label>
              <CustomDropdown options={SCOPES} value={liveMockData.examScope} onChange={(v) => setLiveMockData({ ...liveMockData, examScope: v })} placeholder="E.g. Full" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Platform</label>
            <CustomDropdown options={PLATFORMS} value={liveMockData.platform} onChange={(v) => setLiveMockData({ ...liveMockData, platform: v })} placeholder="E.g. Guidely" allowCustom={true} />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">Mock Name*</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" autoComplete="off" spellCheck="false" value={liveMockData.mockName} onChange={(e) => setLiveMockData({ ...liveMockData, mockName: e.target.value })} placeholder="E.g. SBI PO Prelims Mock 1" className="w-full pl-9 text-sm border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-slate-800 dark:text-slate-200" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Live Until (Optional)</label>
            <input type="datetime-local" value={liveMockData.date} onChange={(e) => setLiveMockData({ ...liveMockData, date: e.target.value })} className="w-full text-sm border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-slate-800 dark:text-slate-200" />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
          <button onClick={saveLiveMock} disabled={savingAnnouncement || !liveMockData.mockName || !liveMockData.examType} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50">
            {savingAnnouncement ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Host Live Mock
          </button>
        </div>
      </div>
    </div>
  );
}
