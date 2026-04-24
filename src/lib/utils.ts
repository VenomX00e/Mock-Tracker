import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getHeatmapColor(percentile: number) {
  if (percentile >= 95) return 'bg-emerald-500 text-white ring-1 ring-emerald-600/20';
  if (percentile >= 90) return 'bg-emerald-400 text-white ring-1 ring-emerald-500/20';
  if (percentile >= 80) return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/20';
  if (percentile >= 70) return 'bg-amber-100 text-amber-800 ring-1 ring-amber-500/20';
  if (percentile > 0) return 'bg-rose-100 text-rose-800 ring-1 ring-rose-500/20';
  return 'bg-slate-100 text-slate-400';
}

export const getPlatformShort = (platform?: string) => {
  if (!platform) return null;
  const p = platform.trim();
  const lower = p.toLowerCase();
  
  if (lower.includes('oliveboard')) return 'OB';
  if (lower.includes('practice mock') || lower.includes('practicemock')) return 'PM';
  if (lower.includes('smartkeeda')) return 'SK';
  if (lower.includes('testbook')) return 'TB';
  if (lower.includes('guidely')) return 'Gl';
  if (lower.includes('yes mock') || lower.includes('yesmock')) return 'YM';
  if (lower.includes('adda')) return 'AD';
  if (lower.includes('learning niti') || lower.includes('learningniti')) return 'LN';
  
  return p.substring(0, 3).toUpperCase();
};
