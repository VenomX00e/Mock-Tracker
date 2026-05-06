import React, { useState, useEffect } from 'react';
import { X, User, Image as ImageIcon, Target, Edit2, LogOut, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../services/AuthContext';
import { CustomDropdown } from './CustomDropdown';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const exams = ['SBI PO', 'IBPS PO', 'SBI Clerk', 'IBPS Clerk', 'RRB PO', 'RRB Clerk', 'RBI Grade B', 'RBI Assistant'];

// 15 avatars including animal themes (all graphical)
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
  "https://api.dicebear.com/7.x/bottts/svg?seed=Penguin&backgroundColor=d1d4f9",
  
  // 5 Aspirants (People vector illustrations)
  "https://api.dicebear.com/7.x/notionists/svg?seed=Study1&backgroundColor=fbe7c6",
  "https://api.dicebear.com/7.x/notionists/svg?seed=Study2&backgroundColor=b4f8c8",
  "https://api.dicebear.com/7.x/lorelei/svg?seed=Focus1&backgroundColor=a0e7e5",
  "https://api.dicebear.com/7.x/lorelei-neutral/svg?seed=Focus2&backgroundColor=ffaebc",
  "https://api.dicebear.com/7.x/micah/svg?seed=Success&backgroundColor=e2f0cb",
  
  // 5 Animals (Vector illustrations)
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f98a.svg", // Fox
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f981.svg", // Lion
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43a.svg", // Wolf
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43c.svg", // Panda
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43b.svg"  // Bear
];

export default function ProfileDialog({ isOpen, onClose, darkMode, setDarkMode }: ProfileDialogProps) {
  const { profile, updateProfile, loading } = useUserProfile();
  const { logout } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [targetedExam, setTargetedExam] = useState('');
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
      setTargetedExam(profile.targetedExam || 'SBI PO');
      setIsCustomExam(profile.targetedExam ? !['', ...exams].includes(profile.targetedExam) : false);
    }
  }, [profile]);

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

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700 relative z-10"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Profile</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 rounded-full transition-colors flex items-center"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 rounded-full transition-colors flex items-center gap-1.5"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading...</div>
        ) : (
          <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
            {isPickingAvatar ? (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                <div className="flex items-center gap-2 mb-4">
                   <button onClick={() => setIsPickingAvatar(false)} className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">← Back</button>
                   <span className="text-slate-700 dark:text-slate-300 font-medium">Choose an Avatar</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {PRESET_AVATARS.map((url, i) => (
                    <div 
                      key={i} 
                      onClick={() => { setPhotoURL(url); setIsPickingAvatar(false); }}
                      className={`cursor-pointer rounded-full p-1 border-2 transition-all ${photoURL === url ? 'border-blue-500 shadow-md scale-110' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 hover:scale-105'}`}
                    >
                      <img src={url} alt={`Preset ${i}`} className="w-full aspect-square rounded-full object-cover bg-slate-50 dark:bg-slate-900" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in slide-in-from-left-4 duration-200">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <img 
                      src={photoURL || `https://ui-avatars.com/api/?name=${displayName || 'User'}`} 
                      alt="Avatar Preview" 
                      className="w-24 h-24 rounded-full border-4 border-white dark:border-slate-700 shadow-md object-cover bg-slate-100 dark:bg-slate-800"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${displayName || 'User'}`}}
                    />
                    <button 
                      onClick={() => setIsPickingAvatar(true)}
                      className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-slate-700 hover:bg-blue-700 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" /> Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-slate-400" /> Targeted Exam
                  </label>
                  {!isCustomExam ? (
                    <CustomDropdown
                      value={targetedExam}
                      onChange={(val) => {
                        if (val === 'Other') {
                          setIsCustomExam(true);
                          setTargetedExam('');
                        } else {
                          setTargetedExam(val);
                        }
                      }}
                      options={exams}
                      placeholder="Select targeted exam"
                      allowCustom={true}
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={targetedExam}
                        onChange={(e) => setTargetedExam(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm outline-none pr-10"
                        placeholder="Enter targeted exam"
                      />
                      <button 
                        type="button" 
                        onClick={() => { setIsCustomExam(false); setTargetedExam('SBI PO'); }} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !displayName.trim()}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
}
