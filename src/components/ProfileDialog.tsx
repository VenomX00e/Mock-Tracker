import React, { useState, useEffect } from 'react';
import { X, User, Image as ImageIcon, Target } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { CustomDropdown } from './CustomDropdown';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const exams = ['SBI PO', 'IBPS PO', 'SBI Clerk', 'IBPS Clerk', 'RRB PO', 'RRB Clerk', 'RBI Grade B', 'RBI Assistant'];

// 10 cartoon style avatars (using Dicebear adventurer/fun-emoji or bottts as reliable placeholders)
const PRESET_AVATARS = [
  "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Lion&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Tiger&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Bear&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Fox&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Wolf&backgroundColor=d1d4f9",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Rabbit&backgroundColor=ffdfbf",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Panda&backgroundColor=ffd5dc",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Koala&backgroundColor=c0aede",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Monkey&backgroundColor=b6e3f4",
  "https://api.dicebear.com/7.x/bottts/svg?seed=Penguin&backgroundColor=d1d4f9"
];

export default function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const { profile, updateProfile, loading } = useUserProfile();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [targetedExam, setTargetedExam] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
      setTargetedExam(profile.targetedExam || 'SBI PO');
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await updateProfile({
      displayName,
      photoURL,
      targetedExam,
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-semibold text-slate-800">Edit Profile</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-center mb-2">
              <img 
                src={photoURL || `https://ui-avatars.com/api/?name=${displayName || 'User'}`} 
                alt="Avatar Preview" 
                className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-slate-100"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${displayName || 'User'}`}}
              />
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">Choose an Avatar</label>
               <div className="grid grid-cols-5 gap-2">
                 {PRESET_AVATARS.map((url, i) => (
                   <div 
                     key={i} 
                     onClick={() => setPhotoURL(url)}
                     className={`cursor-pointer rounded-full p-1 border-2 transition-all ${photoURL === url ? 'border-blue-500 shadow-md scale-110' : 'border-transparent hover:border-slate-300 hover:scale-105'}`}
                   >
                     <img src={url} alt={`Preset ${i}`} className="w-full aspect-square rounded-full object-cover bg-slate-50" />
                   </div>
                 ))}
               </div>
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-slate-400" /> Profile Image URL
              </label>
              <input
                type="text"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-slate-400" /> Targeted Exam
              </label>
              <CustomDropdown
                value={targetedExam}
                onChange={setTargetedExam}
                options={exams}
                placeholder="Select targeted exam"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !displayName.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
