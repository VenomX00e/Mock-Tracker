import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Image as ImageIcon,
  Target,
  Edit2,
  LogOut,
  Sun,
  Moon,
  Calendar,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth } from "../services/AuthContext";
import { CustomDropdown } from "./CustomDropdown";

import { ExamCategory } from "../types";

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme:
    | "light"
    | "dark"
    | "cyber"
    | "cyber-light"
    | "cyber-green"
    | "cyber-lavender"
    | "cyber-pink"
    | "cyber-orange";
  setTheme: (
    theme:
      | "light"
      | "dark"
      | "cyber"
      | "cyber-light"
      | "cyber-green"
      | "cyber-lavender"
      | "cyber-pink"
      | "cyber-orange",
  ) => void;
  categories: ExamCategory[];
  asPage?: boolean;
}

const exams = [
  "SBI PO",
  "IBPS PO",
  "SBI Clerk",
  "IBPS Clerk",
  "RRB PO",
  "RRB Clerk",
  "RBI Grade B",
  "RBI Assistant",
];

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
  "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f43b.svg", // Bear
];

export default function ProfileDialog({
  isOpen,
  onClose,
  theme,
  setTheme,
  categories,
  asPage = false,
}: ProfileDialogProps) {
  const { profile, updateProfile, loading } = useUserProfile();
  const { logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [targetedExam, setTargetedExam] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [bio, setBio] = useState("");
  const [isCustomExam, setIsCustomExam] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setPhotoURL(profile.photoURL || "");
      setTargetedExam(profile.targetedExam || "SBI PO");
      setCategoryId(profile.categoryId || "banking");
      setBio(profile.bio || "");

      const currentCat = categories.find(
        (c) => c.id === (profile.categoryId || "banking"),
      );
      const catExams = currentCat ? currentCat.exams : exams;
      setIsCustomExam(
        profile.targetedExam
          ? !["", ...catExams].includes(profile.targetedExam)
          : false,
      );
    }
  }, [profile, categories]);

  const handleSave = async () => {
    setIsSaving(true);

    // Bio validation
    if (bio && !/^[a-zA-Z0-9\s]*$/.test(bio)) {
      alert("Bio can only contain alphanumeric characters and spaces.");
      setIsSaving(false);
      return;
    }

    try {
      await updateProfile({
        displayName,
        photoURL,
        targetedExam,
        categoryId,
        bio,
      });
      onClose();
    } catch (e: any) {
      alert(e.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const content = (
    <>
      <div
        className={`bg-white dark:bg-slate-900 ${asPage ? "w-full rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden flex-1 min-h-0" : "rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"} relative z-10`}
      >
        {!asPage && (
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md absolute top-0 w-full z-20">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 drop-shadow-sm">
              Profile
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center flex-1">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Loading profile...</p>
          </div>
        ) : (
          <div
            className={`flex-1 overflow-y-auto custom-scrollbar scroll-smooth ${!asPage ? "pt-14" : ""}`}
          >
            {/* Banner */}
            <div className="h-32 sm:h-48 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
              {asPage && (
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                  {theme.startsWith("cyber") && (
                    <div className="flex bg-slate-900/40 backdrop-blur-md rounded-full shadow-lg items-center px-2 py-1 gap-1.5">
                      {[
                        {
                          id: theme.includes("-light")
                            ? "cyber-light"
                            : "cyber",
                          bg: "bg-[#0ea5e9]",
                        },
                        { id: theme.includes("-light") ? "cyber-green-light" : "cyber-green", bg: "bg-[#22c55e]" },
                        { id: theme.includes("-light") ? "cyber-lavender-light" : "cyber-lavender", bg: "bg-[#a855f7]" },
                        { id: theme.includes("-light") ? "cyber-pink-light" : "cyber-pink", bg: "bg-[#ec4899]" },
                        { id: theme.includes("-light") ? "cyber-orange-light" : "cyber-orange", bg: "bg-[#f97316]" },
                      ].map((color) => (
                        <button
                          key={color.id}
                          onClick={() => setTheme(color.id as any)}
                          className={`w-4 h-4 rounded-full ${color.bg} ${theme === color.id ? "ring-2 ring-white scale-110 shadow-[0_0_8px_currentColor]" : "opacity-70 hover:opacity-100 hover:scale-110 transition-all"}`}
                          title={"Select " + color.id.split('-').join(' ')}
                          style={{
                            color: color.bg
                              .replace("bg-[", "")
                              .replace("]", ""),
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (theme.startsWith("cyber")) {
                        setTheme(theme.includes("-light") ? "light" : "dark");
                      } else {
                        setTheme(theme === "light" ? "cyber-light" : "cyber");
                      }
                    }}
                    className={`p-2 backdrop-blur-md rounded-full transition-colors ${theme.startsWith("cyber") ? "bg-indigo-500/80 hover:bg-indigo-600/80 text-white" : "bg-white/20 hover:bg-white/30 text-white"}`}
                    title={
                      theme.startsWith("cyber")
                        ? "Exit Gamer Mode"
                        : "Enter Gamer Mode"
                    }
                  >
                    <Gamepad2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (theme.startsWith("cyber")) {
                        if (theme.includes("-light")) {
                          setTheme(theme.replace("-light", "") as any);
                        } else {
                          setTheme((theme === "cyber" ? "cyber-light" : theme + "-light") as any);
                        }
                      } else {
                        setTheme(theme === "light" ? "dark" : "light");
                      }
                    }}
                    className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-colors"
                    title="Toggle Theme"
                  >
                    {theme === "dark" || (theme.startsWith("cyber") && !theme.includes("-light")) ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="p-2 bg-white/20 hover:bg-white/30 hover:text-rose-100 backdrop-blur-md text-white rounded-full transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 pb-8">
              {isPickingAvatar ? (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-200 mt-6 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-800 dark:text-slate-200 font-semibold text-lg">
                      Choose an Avatar
                    </span>
                    <button
                      onClick={() => setIsPickingAvatar(false)}
                      className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                    {PRESET_AVATARS.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setPhotoURL(url);
                          setIsPickingAvatar(false);
                        }}
                        className={`cursor-pointer rounded-2xl p-1 transition-all ${photoURL === url ? "ring-2 ring-indigo-500 shadow-md scale-105" : "hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 hover:scale-105 opacity-80 hover:opacity-100"}`}
                      >
                        <img
                          src={url}
                          alt={`Preset ${i}`}
                          className="w-full aspect-square rounded-xl object-cover bg-slate-50 dark:bg-slate-800/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-300 relative">
                  {/* Avatar */}
                  <div className="flex justify-between items-end -mt-12 sm:-mt-16 mb-6">
                    <div className="relative group">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-white dark:border-slate-900 shadow-xl overflow-hidden bg-white dark:bg-slate-800">
                        <img
                          src={
                            photoURL ||
                            `https://ui-avatars.com/api/?name=${displayName || "User"}&background=random`
                          }
                          alt="Avatar"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              `https://ui-avatars.com/api/?name=${displayName || "User"}`;
                          }}
                        />
                      </div>
                      <button
                        onClick={() => setIsPickingAvatar(true)}
                        className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white dark:border-slate-900 hover:bg-indigo-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 sm:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      {!asPage && (
                        <button
                          onClick={onClose}
                          className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors hidden sm:block"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={isSaving || !displayName.trim()}
                        className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow transition-all"
                      >
                        {isSaving ? "Saving..." : "Save Profile"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Basic Info Card */}
                    <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-5">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                          Display Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                            placeholder="Enter your name"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                            Bio
                          </label>
                          <span
                            className={`text-xs font-medium ${bio.length > 70 ? "text-rose-500" : "text-slate-400"}`}
                          >
                            {bio.length}/70
                          </span>
                        </div>
                        <input
                          type="text"
                          value={bio}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (
                              val.length <= 70 &&
                              /^[a-zA-Z0-9\s.,!?-]*$/.test(val)
                            ) {
                              setBio(val);
                            }
                          }}
                          maxLength={70}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                          placeholder="Tell us a bit about yourself"
                        />
                      </div>
                    </div>

                    {/* Target & Exam Info Card */}
                    <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-5">
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> Sector
                          </label>
                          <CustomDropdown
                            value={
                              categories.find((c) => c.id === categoryId)
                                ?.name || categoryId
                            }
                            onChange={(val) => {
                              const cat =
                                categories.find((c) => c.name === val) ||
                                categories[0];
                              setCategoryId(cat.id);
                            }}
                            options={categories.map((c) => c.name)}
                            placeholder="Select category"
                            allowCustom={false}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> Targeted Exam
                          </label>
                          {!isCustomExam ? (
                            <CustomDropdown
                              value={targetedExam}
                              onChange={(val) => {
                                if (val === "Other") {
                                  setIsCustomExam(true);
                                  setTargetedExam("");
                                } else {
                                  setTargetedExam(val);
                                }
                              }}
                              options={
                                categories.find((c) => c.id === categoryId)
                                  ?.exams || exams
                              }
                              placeholder="Select targeted exam"
                              allowCustom={true}
                            />
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                value={targetedExam}
                                onChange={(e) =>
                                  setTargetedExam(e.target.value)
                                }
                                className="w-full px-4 py-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm pr-10"
                                placeholder="Enter targeted exam"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomExam(false);
                                  setTargetedExam("SBI PO");
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Achievements */}
                    {profile?.badges && profile.badges.length > 0 && (
                      <div className="p-5 sm:p-6 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/50 dark:border-amber-900/20">
                        <label className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                          Achievements & Badges
                        </label>
                        <div className="flex flex-wrap gap-3">
                          {profile.badges.map((badge: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => setSelectedBadge(badge)}
                              className={`flex items-center gap-2 pr-3 pl-1.5 py-1.5 rounded-xl border font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all
                                ${
                                  badge.imageBase64
                                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                                    : badge.color ||
                                      "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                                }`}
                            >
                              {badge.imageBase64 ? (
                                <>
                                  <img
                                    src={badge.imageBase64}
                                    alt={badge.name}
                                    className="w-7 h-7 rounded-lg shadow-sm object-cover"
                                  />
                                  <span className="text-xs tracking-wide">
                                    {badge.name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-7 h-7 flex items-center justify-center text-lg">
                                    {badge.icon}
                                  </span>
                                  <span className="text-xs tracking-wide">
                                    {badge.name}
                                  </span>
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mobile save button */}
                    {!asPage && (
                      <div className="sm:hidden pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                        <button
                          onClick={onClose}
                          className="flex-1 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving || !displayName.trim()}
                          className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-50"
                        >
                          {isSaving ? "Saving..." : "Save Profile"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedBadge && (
        <div
          className="fixed inset-0 bg-slate-900/30  z-[60] flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setSelectedBadge(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xs shadow-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden flex flex-col p-6 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end -mt-2 -mr-2">
              <button
                onClick={() => setSelectedBadge(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-center mb-4">
              {selectedBadge.imageBase64 ? (
                <img
                  src={selectedBadge.imageBase64}
                  alt={selectedBadge.name}
                  className="w-24 h-24 rounded-full shadow-lg border-4 border-slate-50 dark:border-slate-700 object-cover"
                />
              ) : (
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 border-white dark:border-slate-800 ${selectedBadge.color}`}
                >
                  {selectedBadge.icon}
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
              {selectedBadge.name}
            </h3>
            {selectedBadge.challengeTitle && (
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
                Earned from completing:{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  {selectedBadge.challengeTitle}
                </span>
              </p>
            )}
            <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Awarded{" "}
              {selectedBadge.awardedAt
                ? new Date(selectedBadge.awardedAt).toLocaleDateString()
                : "recently"}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (asPage) return content;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            className="absolute inset-0 bg-slate-900/50 "
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.05 } }}
            className="w-full max-w-md relative z-10"
          >
            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
