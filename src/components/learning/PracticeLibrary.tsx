import React, { useState, useEffect } from 'react';
import { jarvisEventBus } from '../../features/jarvis/utils/eventBus';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase";
import { PracticeFolder, PracticeFile } from "../../types";
import { Folder, Loader2 } from "lucide-react";
import { useSystemDataCtx } from "../../context/AppContext";

import { PracticeFileTile } from './PracticeFileTile';
import { PracticeBreadcrumbs } from './PracticeBreadcrumbs';

export function PracticeLibrary() {
  const { categories, selectedCategory } = useSystemDataCtx();
  const currentCategory = categories.find((c: any) => c.id === selectedCategory);
  const subjects = currentCategory?.subjects || [];

  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<PracticeFolder[]>([]);
  const [files, setFiles] = useState<PracticeFile[]>([]);
  const [folderPath, setFolderPath] = useState<PracticeFolder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleJarvisEvent = (action: any) => {
      if (action.type === 'SUB_NAVIGATE') {
        const { mainTab, subTab, section } = action.payload;
        if (mainTab === 'learning' && subTab === 'practice' && section) {
          // Find the subject id that matches the section name
          if (section === 'quant') setCurrentSubjectId('quant');
          else if (section === 'reasoning') setCurrentSubjectId('reasoning');
          else if (section === 'english') setCurrentSubjectId('english');
          else if (section === 'ga') setCurrentSubjectId('ga');
        }
      } else if (action.type === 'EXECUTE_INTENT' && action.intent === 'FILTER_PRACTICE_SUBJECT') {
        const payload = action.payload || {};
        const subjectTarget = (payload.subject || action.subject || '').toLowerCase();
        if (subjectTarget) {
          const matched = subjects.find((s: any) =>
            s.id.toLowerCase() === subjectTarget ||
            s.name.toLowerCase().includes(subjectTarget) ||
            subjectTarget.includes(s.id.toLowerCase()) ||
            subjectTarget.includes(s.name.toLowerCase())
          );
          if (matched) {
            setCurrentSubjectId(matched.id);
            setParentFolderId(null);
            setFolderPath([]);
          } else {
            // Fallback matching by id
            if (['quant', 'reasoning', 'english', 'ga'].includes(subjectTarget)) {
              setCurrentSubjectId(subjectTarget);
              setParentFolderId(null);
              setFolderPath([]);
            }
          }
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleJarvisEvent);
    return () => unsubscribe();
  }, [subjects]);


  useEffect(() => {
    if (subjects.length > 0 && !currentSubjectId) {
      setCurrentSubjectId(subjects[0].id);
    }
  }, [subjects, currentSubjectId]);

  useEffect(() => {
    if (!currentSubjectId) return;
    setLoading(true);

    const foldersQ = query(
      collection(db, "practice_folders"),
      where("subjectId", "==", currentSubjectId),
      where("parentId", "==", parentFolderId)
    );
    
    const unsubFolders = onSnapshot(foldersQ, (snap) => {
      const loadedFolders: PracticeFolder[] = [];
      snap.forEach(d => {
        const data = { ...d.data(), id: d.id } as PracticeFolder;
        if (!data.isDeleted) {
          loadedFolders.push(data);
        }
      });
      loadedFolders.sort((a,b) => (a.order||0) - (b.order||0));
      setFolders(loadedFolders);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching practice folders:", error);
      setLoading(false);
    });

    let unsubFiles: (() => void) | undefined;
    if (parentFolderId) {
      const filesQ = query(
        collection(db, "practice_files"),
        where("folderId", "==", parentFolderId)
      );
      unsubFiles = onSnapshot(filesQ, (snap) => {
        const loadedFiles: PracticeFile[] = [];
        snap.forEach(d => {
          const data = { ...d.data(), id: d.id } as PracticeFile;
          if (!data.isHidden && !data.isDeleted) {
            loadedFiles.push(data);
          }
        });
        setFiles(loadedFiles);
      }, (error) => {
        console.error("Error fetching practice files:", error);
      });
    } else {
      setFiles([]);
    }

    return () => {
      unsubFolders();
      if (unsubFiles) unsubFiles();
    };
  }, [currentSubjectId, parentFolderId]);

  const traverseToFolder = (folder: PracticeFolder) => {
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-5xl mx-auto px-4 md:px-6">
      {subjects.length > 0 ? (
        <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 w-full overflow-x-auto custom-scrollbar shadow-sm">
          {subjects.map((sub: any) => (
            <button
              key={sub.id}
              onClick={() => {
                setCurrentSubjectId(sub.id);
                setParentFolderId(null);
                setFolderPath([]);
              }}
              className={`shrink-0 px-4 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap outline-none ${currentSubjectId === sub.id ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center p-6 text-slate-500">No subjects found in your category.</div>
      )}

      {currentSubjectId && (
        <>
          <PracticeBreadcrumbs 
            folderPath={folderPath} 
            onTraverseUp={traverseUp} 
            rootName="Library"
            className="bg-white dark:bg-slate-800/50 shadow-sm"
          />

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
              {folders.map(folder => (
                <div key={folder.id} onClick={() => traverseToFolder(folder)} className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Folder className="w-6 h-6 text-amber-500" />
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">{folder.name}</span>
                </div>
              ))}

              {files.map(file => (
                <PracticeFileTile key={file.id} file={file} />
              ))}

              {folders.length === 0 && files.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800/60 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
                  <Folder className="w-10 h-10 mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-slate-600 dark:text-slate-300">It's quiet here...</p>
                  <p className="text-sm mt-1">No practice sets available in this folder yet.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
