import React from 'react';
import { Pin, Pencil } from 'lucide-react';

export interface CountdownCardProps {
  countdown: any;
  now: number;
  tappedCountdownId: string | null;
  setTappedCountdownId: (id: string | null) => void;
  isPinned: boolean;
  canManageCountdowns: boolean;
  togglePin: (id: string, e: React.MouseEvent, canManageCountdowns: boolean) => void;
  setAdminEditCountdown: (countdown: any) => void;
  setAdminTab: (tab: any) => void;
  setIsAdminModalOpen: (isOpen: boolean) => void;
  isModal?: boolean;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({
  countdown: c,
  now,
  tappedCountdownId,
  setTappedCountdownId,
  isPinned,
  canManageCountdowns,
  togglePin,
  setAdminEditCountdown,
  setAdminTab,
  setIsAdminModalOpen,
  isModal = false,
}) => {
  const getCountdownFormat = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return { days, hours };
  };

  const getThemeColors = (color: string) => {
    switch(color) {
      case 'green': return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-600 dark:text-emerald-400', label: 'text-emerald-400 dark:text-emerald-500', bar: 'bg-emerald-500', barBg: 'bg-emerald-200 dark:bg-emerald-900/50', pop: 'text-emerald-700 dark:text-emerald-300', note: 'text-emerald-600/80 dark:text-emerald-400/80' };
      case 'light-green': return { bg: 'bg-lime-50 dark:bg-lime-900/10', border: 'border-lime-200 dark:border-lime-800/50', text: 'text-lime-600 dark:text-lime-400', label: 'text-lime-500 dark:text-lime-600', bar: 'bg-lime-500', barBg: 'bg-lime-200 dark:bg-lime-900/50', pop: 'text-lime-700 dark:text-lime-300', note: 'text-lime-600/80 dark:text-lime-400/80' };
      case 'orange': return { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800/50', text: 'text-orange-600 dark:text-orange-400', label: 'text-orange-400 dark:text-orange-500', bar: 'bg-orange-500', barBg: 'bg-orange-200 dark:bg-orange-900/50', pop: 'text-orange-700 dark:text-orange-300', note: 'text-orange-600/80 dark:text-orange-400/80' };
      case 'light-red': return { bg: 'bg-rose-50 dark:bg-rose-900/10', border: 'border-rose-200 dark:border-rose-800/50', text: 'text-rose-500 dark:text-rose-400', label: 'text-rose-400 dark:text-rose-500', bar: 'bg-rose-400', barBg: 'bg-rose-200 dark:bg-rose-900/50', pop: 'text-rose-600 dark:text-rose-300', note: 'text-rose-500/80 dark:text-rose-400/80' };
      case 'red': return { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800/50', text: 'text-red-600 dark:text-red-400', label: 'text-red-400 dark:text-red-500', bar: 'bg-red-600', barBg: 'bg-red-200 dark:bg-red-900/50', pop: 'text-red-700 dark:text-red-400', note: 'text-red-600/80 dark:text-red-400/80' };
      default: return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-600 dark:text-emerald-400', label: 'text-emerald-400 dark:text-emerald-500', bar: 'bg-emerald-500', barBg: 'bg-emerald-200 dark:bg-emerald-900/50', pop: 'text-emerald-700 dark:text-emerald-300', note: 'text-emerald-600/80 dark:text-emerald-400/80' };
    }
  };

  const { days, hours } = getCountdownFormat(c.date);
  const theme = getThemeColors(c.color || 'green');
  
  // Calculate progress
  const targetDate = new Date(c.date);
  const targetTime = targetDate.getTime();
  // Progress starts from Jan 1st of the target year
  const createdTime = new Date(targetDate.getFullYear(), 0, 1).getTime();
  const total = targetTime - createdTime;
  const remaining = targetTime - now;
  const progress = Math.max(0, Math.min(100, 100 - (remaining / total) * 100));

  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${daysShort[targetDate.getDay()].toLowerCase()} ${targetDate.getDate().toString().padStart(2, '0')} ${monthsShort[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`;

  return (
    <div 
      key={c.id} 
      onClick={() => setTappedCountdownId(tappedCountdownId === c.id ? null : c.id)}
      className={`flex-shrink-0 ${isModal ? 'w-full' : 'w-[205px] sm:w-[225px]'} p-3 sm:p-4 rounded-xl ${theme.bg} border ${theme.border} flex flex-col justify-between overflow-hidden relative shadow-sm snap-start cursor-pointer transition-transform active:scale-[0.98]`} style={{ marginBottom: '0px', marginTop: '0px', paddingBottom: '16px', marginRight: '0px' }}
    >
      <div className="mb-3 relative z-10 flex justify-between items-start gap-2">
         <h3 className={`font-black text-slate-800 dark:text-slate-100 truncate flex-1 animate-subtle-float text-md sm:text-[21px]`} style={{ lineHeight: '1.2', fontFamily: '"Times New Roman", Times, serif', marginTop: '-4px', paddingLeft: '0px', paddingRight: '1px', paddingTop: '2px', marginLeft: '-4px', marginRight: '-22px', textAlign: 'left' }} title={c.title}>{c.title}</h3>
      </div>
      
      <div className="flex flex-col relative z-10" style={{ paddingLeft: '0px', paddingTop: '0px', marginTop: '-14px' }}>
        <div className="flex items-center justify-between" style={{ paddingTop: '0px', marginTop: '14px', marginBottom: '5px' }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`text-sm sm:text-base font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider`}>IN</span>
            <div className="flex items-baseline gap-1.5 sm:gap-2">
          <div className="flex flex-col items-center">
            <span className={`text-xl sm:text-2xl font-black ${theme.text} leading-none`}>{days}</span>
            <span className={`text-[8px] sm:text-[9px] uppercase font-bold ${theme.label} tracking-wider mt-0.5`}>Days</span>
          </div>
          <span className={`text-base sm:text-lg font-bold ${theme.label} opacity-50`}>:</span>
          <div className="flex flex-col items-center">
            <span className={`text-xl sm:text-2xl font-black ${theme.text} leading-none`}>{hours}</span>
            <span className={`text-[8px] sm:text-[9px] uppercase font-bold ${theme.label} tracking-wider mt-0.5`}>Hrs</span>
          </div>
            </div>
          </div>
          
          {canManageCountdowns && tappedCountdownId === c.id && (
            <div className="flex items-center gap-1.5 justify-end animate-in fade-in slide-in-from-right-2" style={{ marginRight: '-12px' }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setAdminEditCountdown(c);
                }}
                className={`p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200`}
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(c.id, e, canManageCountdowns);
                }} 
                className={`p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 ${isPinned ? theme.pop : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`} 
                title={isPinned ? "Unpin" : "Pin"}
              >
                 <Pin className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        {/* Progress bar as divider */}
        <div className={`h-6 w-full rounded-full overflow-hidden mb-2 relative flex items-center justify-center ${theme.barBg}`}>
          <div className={`absolute top-0 left-0 h-full rounded-full ${theme.bar} transition-all duration-00 ease-out`} style={{ width: `${progress}%` }} />
          {/* Shuttle animation overlay */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <div className="w-full h-full bg-linear-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg] animate-shuttle" />
          </div>
          <span className={`relative z-10 text-[11px] font-bold px-2 py-0.5 rounded tracking-wide text-white`}>
            {formattedDate}
          </span>
        </div>
      </div>
      
      <div className="h-4" style={{ marginLeft: '0px', marginTop: '-5px', marginBottom: '-8px', paddingBottom: '0px', paddingRight: '0px' }}>
        {c.note && (
          <p className={`text-xs font-semibold italic truncate`} style={{ color: '#ed3838', paddingLeft: '5px', paddingTop: '1px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }} title={c.note}>{c.note}</p>
        )}
      </div>
    </div>
  );
};
