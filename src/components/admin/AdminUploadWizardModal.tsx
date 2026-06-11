import React, { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { PracticeFile, PracticeFolder } from "../../types";
import { Loader2, X, Upload } from "lucide-react";
import { truncatePdf } from "../../utils/pdfTruncation";
import { compressPdfWithFallback } from "../../utils/pdfCompression";
import { useCloudinary } from "../../hooks/useCloudinary";

export interface AdminUploadWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newFile: PracticeFile) => void;
  currentSubjectId: string | null;
  parentFolderId: string | null;
  folderPath: PracticeFolder[];
  apdfKeys: string[];
  ilovePdfKeys: string[];
}

export function AdminUploadWizardModal({
  isOpen,
  onClose,
  onUploadSuccess,
  currentSubjectId,
  parentFolderId,
  folderPath,
  apdfKeys,
  ilovePdfKeys
}: AdminUploadWizardModalProps) {
  const { uploadFile: uploadToCloudinary } = useCloudinary();
  
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [wizardMode, setWizardMode] = useState<'firebase_file'|'external_link'>('firebase_file');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [workingBlob, setWorkingBlob] = useState<Blob | null>(null);
  const [currentFileSize, setCurrentFileSize] = useState<number>(0);
  const [pageSelection, setPageSelection] = useState("");
  const [compressionLevel, setCompressionLevel] = useState<'none' | 'low' | 'high'>('none');
  const [isTruncating, setIsTruncating] = useState(false);
  const [appliedPageSelection, setAppliedPageSelection] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const [appliedCompression, setAppliedCompression] = useState<'none' | 'low' | 'high'>('none');
  
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState(""); 
  const [channelName, setChannelName] = useState("");
  const [channelLink, setChannelLink] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "Easy" | "Moderate" | "Hard">("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleApplyTruncation = async () => {
    if (!originalFile || !pageSelection.trim()) return;
    setIsTruncating(true);
    try {
      let resultBlob = await truncatePdf(originalFile, pageSelection);
      if (appliedCompression !== 'none') {
         const fileToCompress = new File([resultBlob], originalFile.name, { type: resultBlob.type || 'application/pdf' });
         resultBlob = await compressPdfWithFallback(fileToCompress, apdfKeys, ilovePdfKeys, appliedCompression);
      }
      setWorkingBlob(resultBlob);
      setCurrentFileSize(resultBlob.size);
      setAppliedPageSelection(pageSelection);
    } catch (err: any) {
      alert("Error truncating PDF: " + err.message);
    } finally {
      setIsTruncating(false);
    }
  };

  const handleApplyCompression = async (level: 'none' | 'low' | 'high') => {
    if (!originalFile) return;
    if (level === 'none') {
      setCompressionLevel('none');
      setAppliedCompression('none');
      let blob: Blob = originalFile;
      if (appliedPageSelection) {
        blob = await truncatePdf(originalFile, appliedPageSelection);
      }
      setWorkingBlob(blob);
      setCurrentFileSize(blob.size);
      return;
    }

    setIsCompressing(true);
    setCompressionLevel(level);

    try {
      let blobToCompress: Blob = originalFile;
      if (appliedPageSelection) {
        blobToCompress = await truncatePdf(originalFile, appliedPageSelection);
      }
      
      const fileToCompress = new File([blobToCompress], originalFile.name, { type: blobToCompress.type || 'application/pdf' });
      const compressedBlob = await compressPdfWithFallback(fileToCompress, apdfKeys, ilovePdfKeys, level);
      setWorkingBlob(compressedBlob);
      setCurrentFileSize(compressedBlob.size);
      setAppliedCompression(level);
    } catch (err: any) {
      alert("Error compressing PDF: " + err.message);
      setCompressionLevel(appliedCompression);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleProcessPdf = async () => {
    if (!originalFile || wizardMode !== 'firebase_file') {
      setCurrentStep(3);
      return;
    }

    if (pageSelection.trim() && pageSelection !== appliedPageSelection) {
      alert("Please click 'Apply Truncation' first or clear the input.");
      return;
    }

    if (currentFileSize > 10 * 1024 * 1024) {
      alert("🚨 File still exceeds 10MB limit after processing. Please try high compression, truncate more pages, or use 'External Link'.");
      return;
    }

    setCurrentStep(3);
  };

  const handleUploadMaterial = async () => {
    if (!fileName.trim() || !parentFolderId || !currentSubjectId) return;
    setIsUploading(true);

    try {
      let finalUrl = fileUrl;
      let sizeBytes = 0;
      let mimeType = '';
      let cloudPublicId = '';

      if (wizardMode === 'firebase_file') {
        if (!workingBlob) {
          alert('Please select a file to upload');
          setIsUploading(false);
          return;
        }

        const cloudFolderPath = ["practice_sets", currentSubjectId, ...folderPath.map(f => f.name)].join('/');
        const isRawType = workingBlob.type === 'application/pdf' || workingBlob.type === 'application/zip';
        const resourceType = isRawType ? 'raw' : 'auto';
        
        try {
          const uploadRes = await uploadToCloudinary({
            file: workingBlob as Blob,
            folderPath: cloudFolderPath,
            resourceType,
            fileName: fileName.trim(),
            onProgress: (progress) => setUploadProgress(progress)
          });

          finalUrl = uploadRes.secure_url;
          sizeBytes = uploadRes.bytes;
          cloudPublicId = uploadRes.public_id;

          let resolvedMimeType = workingBlob.type || 'application/pdf';
          if (uploadRes.format === 'pdf') resolvedMimeType = 'application/pdf';
          else if (uploadRes.format === 'zip') resolvedMimeType = 'application/zip';
          mimeType = resolvedMimeType;
        } catch (error: any) {
          console.error("Cloudinary upload error:", error);
          alert(error.message || "Failed to upload file to Cloudinary.");
          setIsUploading(false);
          return;
        }
      }

      const newRef = doc(collection(db, "practice_files"));
      const newFile: PracticeFile = {
        id: newRef.id,
        folderId: parentFolderId,
        subjectId: currentSubjectId,
        name: fileName.trim(),
        type: wizardMode,
        fileMeta: {
          url: finalUrl,
          sizeBytes,
          mimeType,
          cloudPublicId: cloudPublicId || undefined
        },
        createdAt: serverTimestamp() as any
      };

      if (channelName.trim() || channelLink.trim()) {
        newFile.attribution = {
          channelName: channelName.trim(),
          channelLink: channelLink.trim()
        };
      }

      if (difficulty) {
        newFile.difficulty = difficulty;
      }

      await setDoc(newRef, newFile);
      onUploadSuccess(newFile);
    } catch(e) {
      console.error(e);
      alert("Upload failed.");
    }
    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">
            {wizardMode === 'external_link' ? 'External Link' : (
              currentStep === 1 ? 'Upload File' : currentStep === 2 ? 'Process PDF' : 'Details & Save'
            )}
          </h3>
          <button onClick={() => !isUploading && onClose()} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto">
          {currentStep === 1 && (
            <>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setWizardMode('firebase_file')} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${wizardMode==='firebase_file'?'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400':'text-slate-500'}`}>Upload File / PDF</button>
                <button onClick={() => setWizardMode('external_link')} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${wizardMode==='external_link'?'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400':'text-slate-500'}`}>External Link</button>
              </div>

              {wizardMode === 'firebase_file' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">File (PDF/Image) *</label>
                  <input type="file" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setOriginalFile(f);
                      setWorkingBlob(f);
                      setCurrentFileSize(f.size);
                      setPageSelection("");
                      setAppliedPageSelection("");
                      setCompressionLevel('none');
                    } else {
                      setOriginalFile(null);
                      setWorkingBlob(null);
                      setCurrentFileSize(0);
                    }
                  }} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400" />
                  
                  {currentFileSize > 0 && originalFile?.type === 'application/pdf' && (
                    <p className="mt-2 text-xs text-slate-500">
                      Original Size: {(originalFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                  
                  {currentFileSize > 10 * 1024 * 1024 && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-800">
                      File exceeds 10MB limit. Compression or truncation is required in the next step, or switch to External Link.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">URL (Drive/Link) *</label>
                  <input type="url" value={fileUrl} onChange={e=>setFileUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2 text-sm border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </>
          )}

          {currentStep === 2 && wizardMode === 'firebase_file' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                    1. Truncate Pages (Optional)
                  </h4>
                  <p className="text-xs text-slate-500 mb-2">
                    Extract specific pages to reduce size (e.g., "1-10", "1-3, 5"). Leave blank for all pages.
                  </p>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      value={pageSelection} 
                      onChange={(e) => setPageSelection(e.target.value)}
                      placeholder="e.g. 1-10, 15, 20-30" 
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    />
                    <button 
                      onClick={handleApplyTruncation}
                      disabled={isTruncating || !pageSelection.trim() || pageSelection === appliedPageSelection}
                      className="px-3 py-2 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isTruncating ? "Applying..." : (pageSelection === appliedPageSelection && pageSelection.trim() ? "Applied" : "Apply Truncation")}
                    </button>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                    2. API Compression (Optional)
                  </h4>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleApplyCompression('none')}
                      disabled={isCompressing || isTruncating}
                      className={`flex-1 py-1.5 px-2 text-xs rounded border transition-colors ${compressionLevel === 'none' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                    >
                      None
                    </button>
                    <button 
                      onClick={() => handleApplyCompression('low')}
                      disabled={isCompressing || isTruncating}
                      className={`flex-1 py-1.5 px-2 text-xs rounded border transition-colors ${compressionLevel === 'low' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                    >
                      Low Compression
                    </button>
                    <button 
                      onClick={() => handleApplyCompression('high')}
                      disabled={isCompressing || isTruncating}
                      className={`flex-1 py-1.5 px-2 text-xs rounded border transition-colors ${compressionLevel === 'high' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                    >
                      High Compression
                    </button>
                  </div>
                  {isCompressing && (
                    <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 flex items-center">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Compressing with external API...
                    </p>
                  )}
                </div>
                
                <div className="pt-2">
                   <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                     Original Size: {originalFile ? (originalFile.size / (1024 * 1024)).toFixed(2) : 0} MB
                     {appliedPageSelection && appliedCompression === 'none' && (
                       <span className="ml-2 px-2 border-l border-slate-300 dark:border-slate-600">
                         Truncated Size: <span className={currentFileSize > 11*1024*1024 ? 'text-red-500' : 'text-emerald-500'}>{(currentFileSize / (1024 * 1024)).toFixed(2)} MB</span>
                       </span>
                     )}
                     {appliedCompression !== 'none' && (
                       <span className="ml-2 px-2 border-l border-slate-300 dark:border-slate-600">
                         Compressed Size: <span className={currentFileSize > 11*1024*1024 ? 'text-red-500' : 'text-emerald-500'}>{(currentFileSize / (1024 * 1024)).toFixed(2)} MB</span>
                       </span>
                     )}
                   </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Filename *</label>
                <input type="text" value={fileName} onChange={e=>setFileName(e.target.value)} placeholder="Display name" className="w-full px-4 py-2 text-sm border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Difficulty</label>
                <select value={difficulty} onChange={e=>setDifficulty(e.target.value as any)} className="w-full px-4 py-2 text-sm border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">None</option>
                  <option value="Easy">Easy</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Channel Name</label>
                  <input type="text" value={channelName} onChange={e=>setChannelName(e.target.value)} placeholder="e.g. Test" className="w-full px-4 py-2 text-sm border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Channel Link</label>
                  <input type="url" value={channelLink} onChange={e=>setChannelLink(e.target.value)} placeholder="https://" className="w-full px-4 py-2 text-sm border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div>
            {wizardMode === 'firebase_file' && currentStep > 1 && !isUploading && (
              <button 
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => !isUploading && onClose()} 
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
            >
              Cancel
            </button>
            
            {wizardMode === 'firebase_file' ? (
               currentStep === 1 ? (
                 <button 
                   onClick={() => {
                     if (originalFile?.type === 'application/pdf') {
                       setCurrentStep(2);
                     } else if (originalFile) {
                       setCurrentStep(3); // skip processing for non-pdf
                     }
                   }}
                   disabled={!originalFile}
                   className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
                 >
                   Next step
                 </button>
               ) : currentStep === 2 ? (
                 <button 
                   onClick={handleProcessPdf}
                   className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
                 >
                   Next step
                 </button>
               ) : (
                 <div className="flex items-center gap-3">
                   {isUploading && (
                     <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 w-16 text-right">
                       {uploadProgress}%
                     </div>
                   )}
                   <button 
                     onClick={handleUploadMaterial} 
                     disabled={!fileName.trim() || isUploading}
                     className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
                   >
                     {isUploading ? <><Loader2 className="w-4 h-4 animate-spin"/> Uploading...</> : <><Upload className="w-4 h-4"/> Complete Upload</>}
                   </button>
                 </div>
               )
            ) : (
               <button 
                 onClick={handleUploadMaterial} 
                 disabled={!fileName.trim() || !fileUrl.trim() || isUploading}
                 className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50"
               >
                 {isUploading ? <><Loader2 className="w-4 h-4 animate-spin"/> Saving...</> : <><Upload className="w-4 h-4"/> Add Link</>}
               </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}