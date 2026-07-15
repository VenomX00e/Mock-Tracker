import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, getDoc, doc, setDoc, deleteDoc, serverTimestamp, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../../services/firebase";
import { PracticeFolder, PracticeFile } from "../../types";
import { Folder, FolderPlus, FileText, Upload, Link as LinkIcon, Trash2, X, Edit2, Eye, EyeOff, Image as ImageIcon, Archive, Code, History, Loader2, Save } from "lucide-react";
import { useCloudinary } from "../../hooks/useCloudinary";
import { AdminUploadWizardModal } from "./AdminUploadWizardModal";
import { AdminRecycleBinModal } from "./AdminRecycleBinModal";
import { PracticeBreadcrumbs } from "../learning/PracticeBreadcrumbs";
import { CustomDropdown } from "../CustomDropdown";

export function AdminPracticeSetsTab({
  adminCategoryScope,
  isOwner,
  subjects,
  apdfKeys = [],
  ilovePdfKeys = [],
  cloudinaryCloudName = "",
  cloudinaryUploadPreset = ""
}: {
  adminCategoryScope: string | null;
  isOwner: boolean;
  subjects: {id: string, name: string}[];
  apdfKeys?: string[];
  ilovePdfKeys?: string[];
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
}) {
  const { createFolder, deleteResource } = useCloudinary();
  const [folders, setFolders] = useState<PracticeFolder[]>([]);
  const [files, setFiles] = useState<PracticeFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<PracticeFolder[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  // Upload Modal states
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  // Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelLink, setEditChannelLink] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<"" | "Easy" | "Moderate" | "Hard">("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirm states
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{type: 'folder' | 'file', id: string, name: string, fileData?: PracticeFile, mode: 'soft' | 'permanent'} | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Recycle Bin states
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  useEffect(() => {
    if (adminCategoryScope && subjects.length > 0 && !currentSubjectId) {
      setCurrentSubjectId(subjects[0]?.id || null);
    }
  }, [adminCategoryScope, subjects, currentSubjectId]);

  useEffect(() => {
    if (currentSubjectId) {
      fetchContents();
    }
  }, [currentSubjectId, parentFolderId]);

  const fetchContents = async () => {
    if (!currentSubjectId) return;
    setLoading(true);
    try {
      const foldersQ = query(
        collection(db, "practice_folders"),
        where("subjectId", "==", currentSubjectId),
        where("parentId", "==", parentFolderId)
      );
      const foldersSnap = await getDocs(foldersQ);
      const loadedFolders: PracticeFolder[] = [];
      foldersSnap.forEach(d => {
        const data = d.data() as PracticeFolder;
        if (!data.isDeleted) {
          loadedFolders.push({ ...data, id: d.id });
        }
      });
      loadedFolders.sort((a,b) => (a.order||0) - (b.order||0));
      setFolders(loadedFolders);

      if (parentFolderId) {
        const filesQ = query(
          collection(db, "practice_files"),
          where("folderId", "==", parentFolderId)
        );
        const filesSnap = await getDocs(filesQ);
        const loadedFiles: PracticeFile[] = [];
        filesSnap.forEach(d => {
           const data = d.data() as PracticeFile;
           if (!data.isDeleted) {
             loadedFiles.push({ ...data, id: d.id });
           }
        });
        setFiles(loadedFiles);
      } else {
        setFiles([]); 
      }
    } catch (e) {
      console.error("Error fetching contents:", e);
    }
    setLoading(false);
  };

  const handleEditFile = (file: PracticeFile) => {
    setEditingFileId(file.id);
    setEditFileName(file.name);
    setEditChannelName(file.attribution?.channelName || "");
    setEditChannelLink(file.attribution?.channelLink || "");
    setEditDifficulty(file.difficulty || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFileId || !editFileName.trim()) return;
    setIsSavingEdit(true);
    try {
      const fileRef = doc(db, "practice_files", editingFileId);
      const updates: any = {
        name: editFileName.trim(),
        difficulty: editDifficulty || deleteField(),
      };
      
      if (editChannelName.trim() || editChannelLink.trim()) {
        updates.attribution = {
          channelName: editChannelName.trim(),
          channelLink: editChannelLink.trim()
        };
      } else {
        updates.attribution = deleteField(); 
      }

      await updateDoc(fileRef, updates);
      
      setFiles(files.map(f => {
        if (f.id === editingFileId) {
          const updatedFile = { ...f, name: updates.name };
          if (updates.difficulty !== undefined && typeof updates.difficulty !== 'object') {
             updatedFile.difficulty = updates.difficulty;
          } else if (typeof updates.difficulty === 'object') {
             delete updatedFile.difficulty;
          }
          
          if (updates.attribution !== undefined && updates.attribution.channelName) {
             updatedFile.attribution = updates.attribution;
          } else if (typeof updates.attribution === 'object') {
             delete updatedFile.attribution;
          }

          return updatedFile;
        }
        return f;
      }));
      setIsEditModalOpen(false);
    } catch(e) {
      console.error(e);
      alert("Failed to update file details.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim() || !currentSubjectId) return;
    setIsUploading(true);
    try {
      const dbFolderName = folderName.trim();
      const cloudFolderPath = ["practice_sets", currentSubjectId, ...folderPath.map(f => f.name), dbFolderName].join('/');

      // Call secure API to create folder in Cloudinary
      await createFolder(cloudFolderPath);

      const newRef = doc(collection(db, "practice_folders"));
      const newFolder: PracticeFolder = {
        id: newRef.id,
        subjectId: currentSubjectId,
        parentId: parentFolderId,
        name: dbFolderName,
        order: folders.length,
        cloudFolderPath,
        createdAt: serverTimestamp()
      };
      await setDoc(newRef, newFolder);
      setFolders([...folders, newFolder]);
      setIsFolderModalOpen(false);
      setFolderName("");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to create folder");
    } finally {
      setIsUploading(false);
    }
  };

  const traverseToFolder = async (folder: PracticeFolder) => {
    setFolderPath([...folderPath, folder]);
    setParentFolderId(folder.id);
  };

  const traverseUp = (index: number) => {
    if (index === -1) {
      setFolderPath([]);
      setParentFolderId(null);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setParentFolderId(newPath[newPath.length - 1].id);
    }
  };

  const handleDeleteFolderClick = async (folderId: string, folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmItem({ type: 'folder', id: folderId, name: folderName, mode: 'soft' });
    setDeleteConfirmInput("");
  };

  const handleDeleteFileClick = async (file: PracticeFile) => {
    setDeleteConfirmItem({ type: 'file', id: file.id, name: file.name, fileData: file, mode: 'soft' });
    setDeleteConfirmInput("");
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem || deleteConfirmItem.mode !== 'soft') return;

    setIsDeleting(true);
    try {
      if (deleteConfirmItem.type === 'folder') {
        const folderRef = doc(db, "practice_folders", deleteConfirmItem.id);
        await updateDoc(folderRef, {
          isDeleted: true,
          deletedAt: serverTimestamp()
        });
        setFolders(folders.filter(f => f.id !== deleteConfirmItem.id));
      } else if (deleteConfirmItem.type === 'file' && deleteConfirmItem.fileData) {
        const file = deleteConfirmItem.fileData;
        const fileRef = doc(db, "practice_files", file.id);
        await updateDoc(fileRef, {
          isDeleted: true,
          deletedAt: serverTimestamp()
        });
        setFiles(files.filter(f => f.id !== file.id));
      }
      setDeleteConfirmItem(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleHideFile = async (file: PracticeFile) => {
    try {
      const newStatus = !file.isHidden;
      const fileRef = doc(db, "practice_files", file.id);
      await updateDoc(fileRef, { isHidden: newStatus });
      setFiles(files.map(f => f.id === file.id ? { ...f, isHidden: newStatus } : f));
    } catch(e) {
      console.error(e);
      alert("Failed to toggle file visibility.");
    }
  };


  const getFileIcon = (file: PracticeFile) => {
    if (file.type === 'external_link') return <LinkIcon className="w-5 h-5" />;
    const mimeType = file.fileMeta?.mimeType?.toLowerCase() || '';
    if (mimeType.includes('image')) return <ImageIcon className="w-5 h-5" />;
    if (mimeType.includes('html') || mimeType.includes('csv')) return <Code className="w-5 h-5" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <Archive className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Practice Sets
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage folders and upload PDFs or external links
          </p>
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 w-full overflow-x-auto custom-scrollbar shadow-sm">
          {subjects.map(sub => (
            <button
              key={sub.id}
              onClick={() => {
                setCurrentSubjectId(sub.id);
                setParentFolderId(null);
                setFolderPath([]);
              }}
              className={`shrink-0 px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap outline-none ${currentSubjectId === sub.id ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Breadcrumbs */}
      <PracticeBreadcrumbs 
        folderPath={folderPath} 
        onTraverseUp={traverseUp} 
        rootName="Root"
      />

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => setIsFolderModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors">
          <FolderPlus className="w-4 h-4" /> New Folder
        </button>
        {parentFolderId && (
          <button onClick={() => {
            setIsFileModalOpen(true);
          }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
            <Upload className="w-4 h-4" /> Upload Material
          </button>
        )}
        <button onClick={() => setIsRecycleBinOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium transition-colors">
          <History className="w-4 h-4" /> Recycle Bin
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {folders.map(folder => (
            <div key={folder.id} onClick={() => traverseToFolder(folder)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-amber-500" />
                </div>
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{folder.name}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteFolderClick(folder.id, folder.name, e)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {files.map(file => (
            <div key={file.id} className={`bg-white dark:bg-slate-800 border ${file.isHidden ? 'border-amber-200 dark:border-amber-900/50 opacity-60' : 'border-slate-200 dark:border-slate-700'} rounded-2xl p-4 flex flex-col justify-between group relative overflow-hidden`}>
              <div className="absolute top-0 right-0 flex flex-col items-end z-20">
                {file.isHidden && (
                  <div className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                    Hidden
                  </div>
                )}
                {file.difficulty && (
                  <div className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider ${!file.isHidden ? 'rounded-bl-lg' : 'rounded-l-lg'} ${
                    file.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                    file.difficulty === 'Moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                  }`}>
                    {file.difficulty}
                  </div>
                )}
              </div>

              {/* Action Buttons precisely at Top-Left */}
              <div className="absolute top-1 left-2 flex items-center gap-0.5 z-30">
                <button 
                  onClick={() => handleToggleHideFile(file)}
                  className="p-0.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title={file.isHidden ? "Unhide File" : "Hide File"}
                >
                  {file.isHidden ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => handleEditFile(file)}
                  className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Edit File"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => handleDeleteFileClick(file)}
                  className="p-0.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Delete File"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-start justify-between gap-3 mb-2 pt-2 z-10 w-full relative">
                <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${file.type === 'firebase_file' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 line-clamp-2">{file.name}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block capitalize">{file.type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
              {file.attribution && (
                <div className="text-[11px] mt-2 px-2 py-1 bg-slate-50 dark:bg-slate-900 rounded-md text-slate-500 truncate">
                  By: {file.attribution.channelName}
                </div>
              )}
            </div>
          ))}

          {folders.length === 0 && files.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Folder className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No items here.</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">New Folder</h3>
              <button onClick={() => setIsFolderModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4">
              <input type="text" value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="Folder Name" className="w-full px-4 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => setIsFolderModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50" disabled={!folderName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      <AdminUploadWizardModal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        currentSubjectId={currentSubjectId}
        parentFolderId={parentFolderId}
        onUploadSuccess={(newFile) => setFiles((prev) => [newFile, ...prev])}
        folderPath={folderPath}
        apdfKeys={apdfKeys}
        ilovePdfKeys={ilovePdfKeys}
      />

      {/* Edit File Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit File</h3>
              <button disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Title *</label>
                <input type="text" value={editFileName} onChange={e=>setEditFileName(e.target.value)} placeholder="e.g. Set 1 Geometry" className="w-full px-4 py-2 text-sm border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Attribution (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={editChannelName} onChange={e=>setEditChannelName(e.target.value)} placeholder="TG Channel Name" className="w-full px-3 py-2 text-sm border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="url" value={editChannelLink} onChange={e=>setEditChannelLink(e.target.value)} placeholder="TG/Website Link" className="w-full px-3 py-2 text-sm border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Difficulty (Optional)</label>
                <CustomDropdown
                  value={editDifficulty || "None"}
                  options={["None", "Easy", "Moderate", "Hard"]}
                  onChange={(val) => setEditDifficulty(val === "None" ? "" : val as any)}
                  placeholder="Select difficulty"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
              <button disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit || !editFileName.trim()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50">
                {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-600 dark:text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{deleteConfirmItem.mode === 'permanent' ? 'Permanently ' : ''}Delete {deleteConfirmItem.type === 'folder' ? 'Folder' : 'File'}?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                {deleteConfirmItem.mode === 'permanent' ? 
                  `This action is irreversible. The ${deleteConfirmItem.type} "${deleteConfirmItem.name}" will be permanently removed.` :
                  `This item will be moved to the Recycle Bin.`
                }
              </p>
              
              {deleteConfirmItem.mode === 'permanent' && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-left border border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 font-mono uppercase tracking-wider">
                    Type <span className="text-slate-800 dark:text-slate-200 font-bold select-all bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">delete {deleteConfirmItem.name.toLowerCase()}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-500"
                    placeholder={`delete ${deleteConfirmItem.name.toLowerCase()}`}
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={(deleteConfirmItem.mode === 'permanent' && deleteConfirmInput.toLowerCase() !== `delete ${deleteConfirmItem.name.toLowerCase()}`) || isDeleting}
                className="flex-1 px-4 py-2.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recycle Bin Modal */}
      <AdminRecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        currentSubjectId={currentSubjectId}
        onRestoreComplete={fetchContents}
        isOwner={isOwner}
      />
    </div>
  );
}
