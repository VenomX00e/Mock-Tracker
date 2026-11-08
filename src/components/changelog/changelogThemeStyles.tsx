import React from 'react';
import {
  Brain,
  Palette,
  Sliders,
  BarChart2,
  Sparkles,
  Grid,
  Zap,
} from 'lucide-react';
import { auth } from '../../services/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getChangelogIcon(iconName: string) {
  switch (iconName) {
    case 'brain': return <Brain className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
    case 'palette': return <Palette className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
    case 'sliders': return <Sliders className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
    case 'chart': return <BarChart2 className="w-5 h-5 text-pink-500 dark:text-pink-400" />;
    case 'zap': return <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
    case 'grid': return <Grid className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
    default: return <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
  }
}

export function getChangelogThemeStyles(theme?: string) {
  switch (theme) {
    case 'hero-miles':
      return {
        banner: 'bg-gradient-to-tr from-[#1b0a0d] via-[#240e11] to-[#0f0406] border-[#ea3323]/30',
        titleGlow: { textShadow: '0 0 14px rgba(234, 51, 37, 0.45)' },
        titleText: 'text-[#ea3323]',
        badge: 'bg-[#ea3323]/10 border border-[#ea3323]/30 text-[#ea3323]',
        dateText: 'text-[#ea3323]',
        versionBadge: 'bg-[#ea3323]/15 text-rose-300 border border-[#ea3323]/25',
        ambientGlow: 'bg-[#ea3323]/10 dark:bg-[#ea3323]/15',
        inputTitle: 'text-rose-50 border-[#ea3323]/30 focus:border-[#ea3323]',
        inputBadge: 'bg-[#ea3323]/10 dark:bg-[#ea3323]/15 border-[#ea3323]/25 dark:border-[#ea3323]/30 text-[#ea3323] focus:ring-[#ea3323]',
        inputDate: 'text-[#ea3323] border-[#ea3323]/30 focus:border-[#ea3323]',
        inputVer: 'bg-[#ea3323]/10 text-rose-300 border-[#ea3323]/25 focus:ring-[#ea3323]',
      };
    case 'cyber':
      return {
        banner: 'bg-gradient-to-tr from-[#0b0e1a] via-[#111c3a] to-[#070b14] border-sky-500/30',
        titleGlow: { textShadow: '0 0 14px rgba(56, 189, 248, 0.45)' },
        titleText: 'text-sky-450',
        badge: 'bg-sky-500/10 border border-sky-500/30 text-sky-400',
        dateText: 'text-sky-400',
        versionBadge: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
        ambientGlow: 'bg-sky-600/10 dark:bg-sky-600/15',
        inputTitle: 'text-sky-50 border-sky-500/30 focus:border-sky-500',
        inputBadge: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/20 dark:border-sky-500/30 text-sky-400 focus:ring-sky-500',
        inputDate: 'text-sky-400 border-sky-500/30 focus:border-sky-500',
        inputVer: 'bg-sky-500/10 text-sky-300 border-sky-500/25 focus:ring-sky-500',
      };
    case 'cyber-light':
      return {
        banner: 'bg-gradient-to-tr from-sky-100 via-sky-50/70 to-sky-100 border-sky-200',
        titleGlow: { textShadow: '0 1px 2px rgba(14, 165, 233, 0.1)' },
        titleText: 'text-sky-900',
        badge: 'bg-sky-100 border border-sky-200 text-sky-700',
        dateText: 'text-sky-600',
        versionBadge: 'bg-sky-100 text-sky-700 border border-sky-200',
        ambientGlow: 'bg-sky-400/5',
        inputTitle: 'text-sky-900 border-sky-300 focus:border-sky-500',
        inputBadge: 'bg-sky-100 border-sky-200 text-sky-700 focus:ring-sky-500',
        inputDate: 'text-sky-600 border-sky-300 focus:border-sky-500',
        inputVer: 'bg-sky-100 text-sky-700 border-sky-200 focus:ring-sky-500',
      };
    case 'cyber-green':
      return {
        banner: 'bg-gradient-to-tr from-[#05140b] via-[#092815] to-[#020a05] border-emerald-500/30',
        titleGlow: { textShadow: '0 0 14px rgba(34, 197, 94, 0.45)' },
        titleText: 'text-emerald-400',
        badge: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400',
        dateText: 'text-emerald-500',
        versionBadge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
        ambientGlow: 'bg-emerald-600/10 dark:bg-emerald-600/15',
        inputTitle: 'text-emerald-50 border-emerald-500/30 focus:border-emerald-500',
        inputBadge: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 dark:border-emerald-500/30 text-emerald-400 focus:ring-emerald-500',
        inputDate: 'text-emerald-400 border-emerald-500/30 focus:border-emerald-500',
        inputVer: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 focus:ring-emerald-500',
      };
    case 'cyber-green-light':
      return {
        banner: 'bg-gradient-to-tr from-emerald-100 via-emerald-50/75 to-emerald-100 border-emerald-200',
        titleGlow: { textShadow: '0 1px 2px rgba(16, 185, 129, 0.1)' },
        titleText: 'text-emerald-900',
        badge: 'bg-emerald-100 border border-emerald-200 text-emerald-700',
        dateText: 'text-emerald-600',
        versionBadge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        ambientGlow: 'bg-emerald-400/5',
        inputTitle: 'text-emerald-900 border-emerald-300 focus:border-emerald-500',
        inputBadge: 'bg-emerald-100 border-emerald-200 text-emerald-700 focus:ring-emerald-555',
        inputDate: 'text-emerald-600 border-emerald-300 focus:border-emerald-500',
        inputVer: 'bg-emerald-100 text-emerald-70 border-emerald-200 focus:ring-emerald-555',
      };
    case 'cyber-lavender':
      return {
        banner: 'bg-gradient-to-tr from-[#120b1c] via-[#1d0f30] to-[#09050d] border-purple-500/30',
        titleGlow: { textShadow: '0 0 14px rgba(168, 85, 247, 0.45)' },
        titleText: 'text-purple-400',
        badge: 'bg-purple-500/10 border border-purple-500/30 text-purple-400',
        dateText: 'text-purple-400',
        versionBadge: 'bg-purple-500/15 text-purple-300 border border-purple-500/25',
        ambientGlow: 'bg-purple-600/10 dark:bg-purple-600/15',
        inputTitle: 'text-purple-50 border-purple-500/30 focus:border-purple-500',
        inputBadge: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20 dark:border-purple-500/30 text-purple-400 focus:ring-purple-500',
        inputDate: 'text-purple-400 border-purple-500/30 focus:border-purple-500',
        inputVer: 'bg-purple-500/10 text-purple-300 border-purple-500/25 focus:ring-purple-555',
      };
    case 'cyber-lavender-light':
      return {
        banner: 'bg-gradient-to-tr from-purple-100 via-purple-50/75 to-purple-100 border-purple-200',
        titleGlow: { textShadow: '0 1px 2px rgba(168, 85, 247, 0.1)' },
        titleText: 'text-purple-900',
        badge: 'bg-purple-100 border border-purple-200 text-purple-700',
        dateText: 'text-purple-600',
        versionBadge: 'bg-purple-100 text-purple-700 border border-purple-200',
        ambientGlow: 'bg-purple-400/5',
        inputTitle: 'text-purple-900 border-purple-300 focus:border-purple-500',
        inputBadge: 'bg-purple-100 border-purple-200 text-purple-700 focus:ring-purple-500',
        inputDate: 'text-purple-600 border-purple-300 focus:border-purple-500',
        inputVer: 'bg-purple-100 text-purple-70 border-purple-200 focus:ring-purple-500',
      };
    case 'cyber-pink':
      return {
        banner: 'bg-gradient-to-tr from-[#1c0812] via-[#2c0e20] to-[#0f040a] border-pink-500/30',
        titleGlow: { textShadow: '0 0 14px rgba(236, 72, 153, 0.45)' },
        titleText: 'text-pink-400',
        badge: 'bg-pink-500/10 border border-pink-500/30 text-pink-400',
        dateText: 'text-pink-400',
        versionBadge: 'bg-pink-500/15 text-pink-300 border border-pink-500/25',
        ambientGlow: 'bg-pink-600/10 dark:bg-pink-600/15',
        inputTitle: 'text-pink-50 border-pink-500/30 focus:border-pink-500',
        inputBadge: 'bg-pink-500/10 dark:bg-pink-500/15 border-pink-500/20 dark:border-pink-500/30 text-pink-400 focus:ring-pink-500',
        inputDate: 'text-pink-400 border-pink-500/30 focus:border-pink-500',
        inputVer: 'bg-pink-500/10 text-pink-300 border-pink-500/25 focus:ring-pink-500',
      };
    case 'cyber-pink-light':
      return {
        banner: 'bg-gradient-to-tr from-pink-100 via-pink-50/75 to-pink-100 border-pink-200',
        titleGlow: { textShadow: '0 1px 2px rgba(236, 72, 153, 0.1)' },
        titleText: 'text-pink-900',
        badge: 'bg-pink-100 border border-pink-200 text-pink-700',
        dateText: 'text-pink-600',
        versionBadge: 'bg-pink-100 text-pink-700 border border-pink-200',
        ambientGlow: 'bg-pink-400/5',
        inputTitle: 'text-pink-900 border-pink-300 focus:border-pink-500',
        inputBadge: 'bg-pink-100 border-pink-200 text-pink-700 focus:ring-pink-500',
        inputDate: 'text-pink-600 border-pink-300 focus:border-pink-500',
        inputVer: 'bg-pink-100 text-pink-70 border-pink-200 focus:ring-pink-500',
      };
    case 'cyber-orange':
      return {
        banner: 'bg-gradient-to-tr from-[#1f0e08] via-[#31170d] to-[#100704] border-amber-500/30',
        titleGlow: { textShadow: '0 0 14px rgba(245, 158, 11, 0.45)' },
        titleText: 'text-amber-400',
        badge: 'bg-amber-500/10 border border-amber-500/30 text-amber-400',
        dateText: 'text-amber-500',
        versionBadge: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
        ambientGlow: 'bg-amber-600/10 dark:bg-amber-600/15',
        inputTitle: 'text-amber-50 border-amber-500/30 focus:border-amber-500',
        inputBadge: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 dark:border-amber-500/30 text-amber-400 focus:ring-amber-500',
        inputDate: 'text-amber-450 border-amber-500/30 focus:border-[#ea3323]',
        inputVer: 'bg-amber-500/10 text-amber-300 border-amber-500/25 focus:ring-amber-500',
      };
    case 'cyber-orange-light':
      return {
        banner: 'bg-gradient-to-tr from-amber-100 via-amber-50/75 to-amber-100 border-amber-200',
        titleGlow: { textShadow: '0 1px 2px rgba(245, 158, 11, 0.1)' },
        titleText: 'text-amber-900',
        badge: 'bg-amber-100 border border-amber-200 text-amber-700',
        dateText: 'text-amber-650',
        versionBadge: 'bg-amber-100 text-amber-700 border border-amber-200',
        ambientGlow: 'bg-amber-400/5',
        inputTitle: 'text-amber-900 border-amber-300 focus:border-amber-500',
        inputBadge: 'bg-amber-100 border-amber-200 text-amber-700 focus:ring-amber-500',
        inputDate: 'text-amber-600 border-amber-300 focus:border-amber-500',
        inputVer: 'bg-amber-100 text-amber-70 border-amber-200 focus:ring-amber-500',
      };
    case 'dark':
      return {
        banner: 'bg-gradient-to-tr from-slate-950 via-[#131139] to-slate-950 border-indigo-500/25',
        titleGlow: { textShadow: '0 0 12px rgba(99, 102, 241, 0.4)' },
        titleText: 'text-white',
        badge: 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400',
        dateText: 'text-indigo-400',
        versionBadge: 'bg-slate-800 text-slate-300 border border-slate-700',
        ambientGlow: 'bg-indigo-600/10',
        inputTitle: 'text-white border-indigo-500/30 focus:border-indigo-500',
        inputBadge: 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20 dark:border-indigo-500/30 text-indigo-400 focus:ring-indigo-500',
        inputDate: 'text-indigo-400 border-indigo-500/30 focus:border-indigo-500',
        inputVer: 'bg-slate-800 text-slate-300 border-slate-700 focus:ring-slate-500',
      };
    case 'light':
    default:
      return {
        banner: 'bg-gradient-to-tr from-slate-200 via-slate-50 to-slate-200 border-slate-205',
        titleGlow: { textShadow: '0 1px 1px rgba(99, 102, 241, 0.05)' },
        titleText: 'text-slate-900',
        badge: 'bg-indigo-50 border border-indigo-100 text-indigo-600',
        dateText: 'text-indigo-600',
        versionBadge: 'bg-slate-100 text-slate-700 border border-slate-200',
        ambientGlow: 'bg-indigo-600/5',
        inputTitle: 'text-slate-900 border-slate-300 focus:border-indigo-500',
        inputBadge: 'bg-indigo-50/80 border-indigo-150 text-indigo-600 focus:ring-indigo-500',
        inputDate: 'text-indigo-600 border-slate-300 focus:border-indigo-500',
        inputVer: 'bg-slate-100 text-slate-700 border-slate-200 focus:ring-indigo-500',
      };
  }
}
