import React from 'react';
import { BookOpen } from 'lucide-react';

export function AdminLearningTab() {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 absolute inset-0 text-center items-center justify-center p-6">
      <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Learning Management</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        Go to the Learning section in the app sidebar to add and edit Editorial Vocabs directly.
      </p>
    </div>
  );
}
