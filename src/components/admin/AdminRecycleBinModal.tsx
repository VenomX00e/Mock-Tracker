import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { PracticeFile, PracticeFolder } from "../../types";
import { X, RefreshCcw, Loader2, Folder, FileText, Link as LinkIcon, Image as ImageIcon, Archive, Code, Trash2 } from "lucide-react";
import { useCloudinary } from "../../hooks/useCloudinary";

export interface AdminRecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubjectId: string | null;
  onRestoreComplete: () => void;
  isOwner?: boolean;
}

export function AdminRecycleBinModal({
  isOpen,
  onClose,
  currentSubjectId,
  onRestoreComplete,
  isOwner
}: AdminRecycleBinModalProps) {
  const { deleteResource } = useCloudinary();
  const [deletedFolders, setDeletedFolders] = useState<PracticeFolder[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<PracticeFile[]>([]);
  const [isRecycleBinLoading, setIsRecycleBinLoading] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{type: 'folder' | 'file', id: string, name: string, fileData?: PracticeFile, folderData?: PracticeFolder} | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && currentSubjectId) {
      fetchDeletedItems();
    }
  }, [isOpen, currentSubjectId]);

  const fetchDeletedItems = async () => {
    if (!currentSubjectId) return;
    setIsRecycleBinLoading(true);
    try {
      const foldersQ = query(
        collection(db, "practice_folders"),
        where("subjectId", "==", currentSubjectId),
        where("isDeleted", "==", true)
      );
      const foldersSnap = await getDocs(foldersQ);
      const dFolders: PracticeFolder[] = [];
      const allSubjectFolderIds = new Set<string>();
      
      foldersSnap.forEach(d => {
        allSubjectFolderIds.add(d.id);
        const data = d.data() as PracticeFolder;
        dFolders.push({ ...data, id: d.id });
      });

      const filesQ = query(
        collection(db, "practice_files"),
        where("subjectId", "==", currentSubjectId),
        where("isDeleted", "==", true)
      );
      const filesSnap = await getDocs(filesQ);
      const dFiles: PracticeFile[] = [];
      filesSnap.forEach(d => {
        const data = d.data() as PracticeFile;
        dFiles.push({ ...data, id: d.id });
      });

      setDeletedFolders(dFolders.sort((a,b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0)));
      setDeletedFiles(dFiles.sort((a,b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0)));
    } catch (e) {
      console.error("Error fetching deleted items:", e);
    }
    setIsRecycleBinLoading(false);
  };

  const handleRestoreItem = async (type: 'folder' | 'file', id: string) => {
    try {
      if (type === 'folder') {
        const folderDoc = doc(db, "practice_folders", id);
        await updateDoc(folderDoc, { isDeleted: false, deletedAt: null });
        setDeletedFolders(prev => prev.filter(f => f.id !== id));
      } else {
         const fileDoc = doc(db, "practice_files", id);
         await updateDoc(fileDoc, { isDeleted: false, deletedAt: null });
         setDeletedFiles(prev => prev.filter(f => f.id !== id));
      }
      onRestoreComplete();
    } catch (e) {
      console.error(e);
      alert("Failed to restore item.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    
    const confirmStr = `delete ${deleteConfirmItem.name.toLowerCase()}`;
    if (deleteConfirmInput.toLowerCase() !== confirmStr.toLowerCase()) {
      alert("Please type the required confirmation text correctly.");
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteConfirmItem.type === 'folder' && deleteConfirmItem.folderData) {
        if (deleteConfirmItem.folderData.cloudFolderPath) {
          try {
            await deleteResource('folder', { folderPath: deleteConfirmItem.folderData.cloudFolderPath });
          } catch(e) {
            console.error("Cloudinary folder deletion error:", e);
          }
        }
        await deleteDoc(doc(db, "practice_folders", deleteConfirmItem.id));
        setDeletedFolders(deletedFolders.filter(f => f.id !== deleteConfirmItem.id));
      } else if (deleteConfirmItem.type === 'file' && deleteConfirmItem.fileData) {
        const file = deleteConfirmItem.fileData;
        if (file.fileMeta?.cloudPublicId) {
          let cloudResourceType = 'image';
          const mimeType = file.fileMeta?.mimeType?.toLowerCase() || '';
          if (mimeType.includes('pdf') || mimeType.includes('zip') || mimeType.includes('csv') || mimeType.includes('tar') || mimeType.includes('rar')) {
            cloudResourceType = 'raw';
          } else if (mimeType.includes('video')) {
            cloudResourceType = 'video';
          }
          await deleteResource('file', {
            public_id: file.fileMeta.cloudPublicId,
            cloudResourceType
          });
        }
        await deleteDoc(doc(db, "practice_files", file.id));
        setDeletedFiles(deletedFiles.filter(f => f.id !== file.id));
      }
      setDeleteConfirmItem(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete");
    } finally {
      setIsDeleting(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Recycle Bin</h3>
            <p className="text-xs text-slate-500">Deleted items can be restored here. Files deleted permanently (red trash button from Recycle Bin) cannot be recovered.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">
          {isRecycleBinLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {deletedFolders.length === 0 && deletedFiles.length === 0 ? (
                 <div className="py-12 text-center text-slate-500">
                   Recycle bin is empty.
                 </div>
              ) : (
                <div className="space-y-4">
                  {deletedFolders.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Folders</h4>
                      <div className="space-y-2">
                        {deletedFolders.map(folder => (
                          <div key={folder.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                                <Folder className="w-4 h-4 text-amber-500" />
                              </div>
                              <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{folder.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleRestoreItem('folder', folder.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors">
                                <RefreshCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                              {isOwner && (
                                <button onClick={() => {
                                  setDeleteConfirmItem({ type: 'folder', id: folder.id, name: folder.name, folderData: folder });
                                  setDeleteConfirmInput("");
                                }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {deletedFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Files</h4>
                      <div className="space-y-2">
                        {deletedFiles.map(file => (
                           <div key={file.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl gap-3">
                             <div className="flex items-start gap-3">
                               <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                 {getFileIcon(file)}
                               </div>
                               <div>
                                 <span className="font-medium text-sm text-slate-700 dark:text-slate-300 block">{file.name}</span>
                                 <span className="text-[11px] text-slate-500">Deleted: {file.deletedAt ? new Date(file.deletedAt.seconds * 1000).toLocaleString() : 'Recently'}</span>
                               </div>
                             </div>
                             <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                               <button onClick={() => handleRestoreItem('file', file.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors">
                                 <RefreshCcw className="w-3.5 h-3.5" /> Restore
                               </button>
                               {isOwner && (
                                 <button onClick={() => {
                                   setDeleteConfirmItem({ type: 'file', id: file.id, name: file.name, fileData: file });
                                   setDeleteConfirmInput("");
                                 }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition-colors">
                                   <Trash2 className="w-3.5 h-3.5" /> Delete
                                 </button>
                               )}
                             </div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-red-600 dark:text-red-500">Permanent Delete</h3>
              <button onClick={() => setDeleteConfirmItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                You are about to permanently delete the {deleteConfirmItem.type} <strong>{deleteConfirmItem.name}</strong>. This cannot be undone. 
                Type <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">delete {deleteConfirmItem.name.toLowerCase()}</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={`delete ${deleteConfirmItem.name.toLowerCase()}`}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-red-500 text-sm"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
              <button onClick={() => setDeleteConfirmItem(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmInput.toLowerCase() !== `delete ${deleteConfirmItem.name.toLowerCase()}` || isDeleting}
                className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
