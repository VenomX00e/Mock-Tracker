import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileImage, Sparkles, AlertCircle, CheckCircle2, Shield, UserCheck, UserX, Loader2, Plus, Info, Lock, Trophy, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { YptChallenge, YptExtractedMemberData, YptRuleConfig } from '../../../types/yptTypes';
import { parseYptScreenshot } from '../../../services/yptOcrService';
import { addYptSubmissionLog, evaluatePointRule } from '../../../services/yptService';
import { useAuthCtx } from '../../../context/AppContext';
import { formatStudyDuration, getLocalYmd } from '../../../utils/yptUtils';
import { useGeminiResolution } from '../../../hooks/useGeminiResolution';

interface YptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenges: YptChallenge[];
  onSuccess: () => void;
  initialChallengeId?: string;
}

export function YptUploadModal({ isOpen, onClose, challenges, onSuccess, initialChallengeId }: YptUploadModalProps) {
  const { user } = useAuthCtx();
  const { isFeatureAllowed, isModelLocked, activeModel } = useGeminiResolution('ypt_screenshot_parser');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    initialChallengeId || challenges[0]?.id || ''
  );
  const [selectedDateYmd, setSelectedDateYmd] = useState<string>(getLocalYmd(new Date()));

  useEffect(() => {
    if (initialChallengeId) {
      setSelectedChallengeId(initialChallengeId);
    } else if (challenges.length > 0 && (!selectedChallengeId || !challenges.some(c => c.id === selectedChallengeId))) {
      setSelectedChallengeId(challenges[0].id);
    }
  }, [initialChallengeId, challenges, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDateYmd(getLocalYmd(new Date()));
    }
  }, [isOpen]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const [extractedData, setExtractedData] = useState<YptExtractedMemberData[] | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setError('');
    setExtractedData(null);
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    setImageFile(file);
    setMimeType(file.type || 'image/png');
    setImagePreviewUrl(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      // strip data:image/...;base64,
      const base64Str = res.split(',')[1] || res;
      setImageBase64(base64Str);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRunOcr = async () => {
    if (!isFeatureAllowed) {
      setError('An API Key is required for YPT Screenshot Parser. Please add your Gemini key in Settings or request access from your Administrator.');
      return;
    }

    if (!imageBase64) {
      setError('Please upload a YPT screenshot first.');
      return;
    }

    const currentChallenge = challenges.find((c) => c.id === selectedChallengeId);
    if (!currentChallenge) {
      setError('Please select an active YPT challenge.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const results = await parseYptScreenshot(
        { base64: imageBase64, mimeType },
        currentChallenge.rules,
        activeModel
      );
      setExtractedData(results);
    } catch (err: any) {
      console.error('YPT OCR Error:', err);
      setError(err.message || 'Failed to extract data from screenshot.');
    } finally {
      setIsProcessing(false);
    }
  };

  const PRESET_EMOJIS = ['☀️', '🌻', '📱', '🔟', '🔥', '🎯', '⏰', '🏆', '⚡', '🏞️', '📑'];

  const recalculateMemberPoints = (
    member: YptExtractedMemberData,
    newDetectedEmojis: string[],
    newMorningSnap: boolean
  ): YptExtractedMemberData => {
    const currentChallenge = challenges.find((c) => c.id === selectedChallengeId);
    const rules = currentChallenge?.rules || {
      pointsPerStudyHour: 2,
      morningSnapBonus: 5,
      noStudyPenaltyThresholdHours: 3,
      penaltyPoints: 5,
    };

    const pointsPerStudyHour = rules.pointsPerStudyHour ?? 2;
    const noStudyThreshold = rules.noStudyPenaltyThresholdHours ?? 3;
    const penaltyPoints = rules.penaltyPoints ?? 5;

    let points = Math.floor(member.hoursStudied) * pointsPerStudyHour;
    if (member.hoursStudied < noStudyThreshold) {
      points -= penaltyPoints;
    }

    const detectedRules: Array<{ ruleId?: string; ruleName: string; emoji: string; points: number }> = [];

    if (Array.isArray(rules.customRules)) {
      for (const cr of rules.customRules) {
        if (!cr || !cr.name) continue;
        const p = Number(cr.points) || 0;

        if (evaluatePointRule(cr, newDetectedEmojis, member.hoursStudied, newMorningSnap)) {
          if (cr.type === 'bonus') {
            points += p;
          } else if (cr.type === 'penalty') {
            points -= p;
          }

          detectedRules.push({
            ruleId: cr.id,
            ruleName: cr.name,
            emoji: cr.emoji || '✨',
            points: cr.type === 'bonus' ? p : -p,
          });
        }
      }
    }

    return {
      ...member,
      morningSnap: newMorningSnap,
      detectedEmojis: newDetectedEmojis,
      detectedRules: detectedRules,
      pointsEarned: points,
    };
  };

  const handleToggleEmojiForMember = (memberIdx: number, emojiToToggle: string) => {
    if (!extractedData) return;
    const member = extractedData[memberIdx];
    if (!member) return;

    const currentEmojis = Array.isArray(member.detectedEmojis) ? [...member.detectedEmojis] : [];
    let updatedEmojis: string[];

    if (currentEmojis.some((e) => e.includes(emojiToToggle) || emojiToToggle.includes(e))) {
      updatedEmojis = currentEmojis.filter((e) => !e.includes(emojiToToggle) && !emojiToToggle.includes(e));
    } else {
      updatedEmojis = [...currentEmojis, emojiToToggle];
    }

    const isMorningSnapEmoji = emojiToToggle === '☀️';
    const updatedSnap = isMorningSnapEmoji
      ? updatedEmojis.includes('☀️')
      : member.morningSnap;

    const updatedMember = recalculateMemberPoints(member, updatedEmojis, updatedSnap);

    setExtractedData((prev) => {
      if (!prev) return null;
      const next = [...prev];
      next[memberIdx] = updatedMember;
      return next;
    });
  };

  // Challenge Start Date & Date Navigation Helpers
  const currentChallenge = challenges.find((c) => c.id === selectedChallengeId);

  const getChallengeStartDateYmd = (challenge?: YptChallenge | null): string => {
    if (!challenge || !challenge.startDate) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return getLocalYmd(d);
    }
    const raw = String(challenge.startDate).trim();
    if (raw.includes('T')) {
      const ymd = raw.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return getLocalYmd(parsed);
    }
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalYmd(d);
  };

  const minAllowedDateYmd = getChallengeStartDateYmd(currentChallenge);
  const todayYmd = getLocalYmd(new Date());

  const isPrevDisabled = selectedDateYmd <= minAllowedDateYmd;
  const isNextDisabled = selectedDateYmd >= todayYmd;

  const getDayOffset = (dateYmd: string): number => {
    const todayStr = getLocalYmd(new Date());
    if (dateYmd === todayStr) return 0;

    const [tY, tM, tD] = todayStr.split('-').map(Number);
    const [sY, sM, sD] = dateYmd.split('-').map(Number);

    const tDate = new Date(tY, tM - 1, tD);
    const sDate = new Date(sY, sM - 1, sD);

    const diffMs = sDate.getTime() - tDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const getOffsetLabel = (offset: number): string => {
    if (offset === 0) return 'Today';
    if (offset === -1) return 'Yesterday';
    if (offset === -2) return '2 days ago';
    if (offset === -3) return '3 days ago';
    return `${Math.abs(offset)} days ago`;
  };

  const formatDateDisplay = (dateYmd: string): string => {
    if (!dateYmd) return '';
    const [y, m, d] = dateYmd.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const offset = getDayOffset(dateYmd);
    const label = getOffsetLabel(offset);
    return `${formatted} (${label})`;
  };

  const handlePrevDate = () => {
    if (!isPrevDisabled) {
      const [y, m, d] = selectedDateYmd.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      const nextYmd = getLocalYmd(dateObj);
      if (nextYmd >= minAllowedDateYmd) {
        setSelectedDateYmd(nextYmd);
      }
    }
  };

  const handleNextDate = () => {
    if (!isNextDisabled) {
      const [y, m, d] = selectedDateYmd.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() + 1);
      const nextYmd = getLocalYmd(dateObj);
      if (nextYmd <= todayYmd) {
        setSelectedDateYmd(nextYmd);
      }
    }
  };

  const handleConfirmSave = async () => {
    if (!extractedData || extractedData.length === 0) return;
    if (!user) {
      setError('You must be signed in to submit logs.');
      return;
    }
    if (!selectedChallengeId) {
      setError('Please select a challenge.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const totalPoints = extractedData.reduce((acc, curr) => acc + curr.pointsEarned, 0);

      await addYptSubmissionLog(selectedChallengeId, {
        challengeId: selectedChallengeId,
        uploaderUid: user.uid,
        imageUrl: imagePreviewUrl || '',
        extractedMembers: extractedData,
        totalPointsAwarded: totalPoints,
        dateYmd: selectedDateYmd,
        status: 'verified',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving YPT submission:', err);
      setError(err.message || 'Failed to save submission log.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal panel body */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0F0F16] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col z-10 my-auto">
        {/* Top Banner Header */}
        <div className="relative p-5 sm:p-7 bg-gradient-to-b from-indigo-50/80 via-indigo-50/20 to-transparent dark:from-indigo-950/40 dark:via-indigo-950/10 dark:to-transparent border-b border-slate-100 dark:border-slate-800/80 shrink-0 select-none">
          <div className="flex items-center justify-between mb-2.5">
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>YPT AI VERIFICATION</span>
            </span>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            AI YPT Screenshot Verification
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Extract study duration and calculate points with Gemini Vision AI.
          </p>
          {isModelLocked && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-medium text-amber-800 dark:text-amber-300">
              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
              <span>🔒 Model locked to [{activeModel}] (Using Admin Global Key)</span>
            </div>
          )}
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 sm:p-7 space-y-5 overflow-y-auto flex-1">
          {!isFeatureAllowed && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm mb-0.5 text-amber-900 dark:text-amber-100">API Key Required</p>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  An API Key is required for YPT Screenshot Parser. Please add your Gemini key in Settings or request access from your Administrator.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Challenge Selector */}
          {initialChallengeId ? (
            <div className="flex items-center justify-between p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target Challenge</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {challenges.find((c) => c.id === selectedChallengeId)?.title || 'Selected Challenge'}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-300/50 dark:border-slate-700 shrink-0">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Locked to this challenge</span>
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Select Target Challenge *
              </label>
              <select
                value={selectedChallengeId}
                onChange={(e) => setSelectedChallengeId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white font-medium"
              >
                {challenges.length === 0 ? (
                  <option value="">No Active Challenges Found</option>
                ) : (
                  challenges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Date Selector Toolbar (Bounded by Challenge Start Date) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Screenshot Date *
            </label>
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl select-none">
              <button
                type="button"
                onClick={handlePrevDate}
                disabled={isPrevDisabled}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                title={`Previous day (challenge start: ${minAllowedDateYmd})`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>{formatDateDisplay(selectedDateYmd)}</span>
              </div>

              <button
                type="button"
                onClick={handleNextDate}
                disabled={isNextDisabled}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                title="Next day (up to Today)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Upload Drop Zone */}
          {!imagePreviewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-950/50 transition-all cursor-pointer"
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
                className="hidden"
                id="ypt-screenshot-upload"
              />
              <label htmlFor="ypt-screenshot-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Drop your YPT group screenshot here, or <span className="text-indigo-500 underline">browse</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports PNG, JPG, WebP screenshots containing group members and study times.
                </p>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Image Preview Box */}
              <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-2 flex flex-col items-center justify-center min-h-[180px]">
                <img
                  src={imagePreviewUrl}
                  alt="YPT Screenshot"
                  className="max-h-48 object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreviewUrl(null);
                    setImageBase64(null);
                    setExtractedData(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Remove Image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* OCR Action or Status */}
              <div className="md:col-span-2 flex flex-col justify-center bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                {!extractedData ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Screenshot ready for parsing. Gemini AI will analyze study hours, morning snaps, and match registered YPT handles.
                    </p>
                    <button
                      type="button"
                      onClick={handleRunOcr}
                      disabled={isProcessing}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing Study Hours & Matching Handles...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Run Gemini Vision AI OCR</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                      <span>OCR Extraction Preview</span>
                      <span>{extractedData.length} Members Found</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Review matched handles and study hour score adjustments below before saving.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extracted Members Table / Interactive Verification */}
          {extractedData && extractedData.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-100/90 dark:bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 grid grid-cols-12 gap-2 items-center border-b border-slate-200 dark:border-slate-800">
                <span className="col-span-3">YPT Member</span>
                <span className="col-span-2 text-center">Duration</span>
                <span className="col-span-5 text-center">Challenge Badges (Click to Toggle)</span>
                <span className="col-span-2 text-right">Points Earned</span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {extractedData.map((m, idx) => {
                  const currentChallenge = challenges.find((c) => c.id === selectedChallengeId);
                  const rules = currentChallenge?.rules;
                  const customRules = rules?.customRules && rules.customRules.length > 0
                    ? rules.customRules
                    : [
                        {
                          id: 'default_snap',
                          name: 'Morning Snap',
                          emoji: '☀️',
                          points: rules?.morningSnapBonus || 5,
                          type: 'bonus' as const,
                        },
                      ];

                  const memberEmojis = Array.isArray(m.detectedEmojis) ? m.detectedEmojis : [];

                  return (
                    <div key={idx} className="p-3.5 text-xs grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900/90 hover:bg-slate-50/80 dark:hover:bg-slate-900 transition-colors">
                      {/* YPT Handle & User Match */}
                      <div className="col-span-3 flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 font-bold dark:text-slate-100 truncate">
                          {m.matchedUid ? (
                            <span className="text-emerald-500 flex items-center gap-1 shrink-0" title="Matched to App User Profile">
                              <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            </span>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1 shrink-0" title="Unmatched YPT Handle">
                              <UserX className="w-3.5 h-3.5 shrink-0" />
                            </span>
                          )}
                          <span className="truncate">{m.yptHandle}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {m.matchedUid ? 'Profile Linked' : 'Unmatched'}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="col-span-2 text-center font-bold text-slate-800 dark:text-slate-100 font-mono text-sm">
                        {formatStudyDuration(m.hoursStudied)}
                      </div>

                      {/* Badge Emojis / Rule Toggles */}
                      <div className="col-span-5 flex flex-wrap items-center justify-center gap-1.5">
                        {customRules.map((cr) => {
                          const crEmoji = cr.emoji || '☀️';
                          const isActive =
                            (crEmoji && memberEmojis.some((e) => e.includes(crEmoji) || crEmoji.includes(e))) ||
                            (m.morningSnap && (crEmoji === '☀️' || cr.name.toLowerCase().includes('snap')));

                          return (
                            <button
                              key={cr.id}
                              type="button"
                              onClick={() => handleToggleEmojiForMember(idx, crEmoji)}
                              className={`px-2 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer select-none ${
                                isActive
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 dark:bg-amber-500/25 shadow-xs scale-102'
                                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 border-slate-200 dark:border-slate-700/80 opacity-60 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                              title={`Click to ${isActive ? 'remove' : 'add'} ${cr.name} (${cr.type === 'bonus' ? '+' : '-'}${cr.points} XP)`}
                            >
                              <span className="text-sm">{crEmoji}</span>
                              <span className="hidden sm:inline text-[10px] font-semibold">{cr.name}</span>
                              <span className="text-[10px] font-black">
                                {cr.type === 'bonus' ? '+' : '-'}{cr.points}
                              </span>
                            </button>
                          );
                        })}

                        {/* Additional Preset Emojis Toggle Menu */}
                        <div className="relative group">
                          <button
                            type="button"
                            className="px-1.5 py-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 rounded-xl transition-all flex items-center gap-0.5"
                            title="Add / Override extra badge emoji"
                          >
                            <Plus className="w-3 h-3" />
                            <span>More</span>
                          </button>
                          <div className="absolute right-0 bottom-full mb-1 hidden group-hover:flex items-center gap-1 p-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20">
                            {PRESET_EMOJIS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => handleToggleEmojiForMember(idx, e)}
                                className="w-6 h-6 flex items-center justify-center text-xs rounded-lg hover:bg-slate-800 transition-colors"
                                title={`Toggle ${e}`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Points Earned & Audit Breakdown */}
                      <div className="col-span-2 text-right">
                        <div className={`font-black text-sm ${m.pointsEarned >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {m.pointsEarned >= 0 ? `+${m.pointsEarned}` : m.pointsEarned} XP
                        </div>
                        {Array.isArray(m.detectedRules) && m.detectedRules.length > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium truncate" title={m.detectedRules.map((r) => `${r.emoji} ${r.ruleName}`).join(', ')}>
                            {m.detectedRules.map((r) => r.emoji).join(' ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Sticky Submit Actions Footer */}
        <div className="flex items-center justify-end gap-3 p-4 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>

          {extractedData && (
            <button
              type="button"
              onClick={handleConfirmSave}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Study Log...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Update Leaderboard</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
