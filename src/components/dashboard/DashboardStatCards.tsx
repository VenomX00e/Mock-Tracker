import React from 'react';
import { Flame, Trophy, Target, TrendingUp, CalendarDays } from 'lucide-react';

interface DashboardStatCardsProps {
  profile: any;
  stats: any;
  goalPercentile: number;
  goalPercentileStr: string;
  setGoalPercentileStr: (str: string) => void;
  leaderboardRank: number | null;
}

export const DashboardStatCards: React.FC<DashboardStatCardsProps> = ({
  profile,
  stats,
  goalPercentile,
  goalPercentileStr,
  setGoalPercentileStr,
  leaderboardRank
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-jarvis-section="mock-summary">
      {/* 1. Streak */}
      <div 
        className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm border-l-4 transition-colors ${profile?.streakActive !== false ? 'border-l-orange-500 border-slate-100 dark:border-slate-700' : 'border-l-slate-300 dark:border-l-slate-600 border-slate-100 dark:border-slate-700'}`}
        data-jarvis-stat={`studyStreak: ${profile?.streak || 0} days`}
      >
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
          <Flame className={`w-5 h-5 ${profile?.streakActive !== false ? 'text-orange-500 animate-pulse drop-shadow-sm' : 'text-slate-300 dark:text-slate-600'}`} />
          <span className={`font-medium text-xs sm:text-sm truncate ${profile?.streakActive === false && 'text-slate-400 dark:text-slate-500'}`}>Streak</span>
        </div>
        <div className={`text-3xl font-light ${profile?.streakActive !== false ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'}`}>{profile?.streak || 0}</div>
      </div>

      {/* 2. Avg Percentile */}
      <div 
        className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-indigo-500 relative overflow-hidden transition-all"
        data-jarvis-stat={`percentile: ${stats.avgPercentile}th`}
      >
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-2 mt-1">
          <Trophy className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          <span className="font-medium text-xs sm:text-sm truncate">Avg Percentile</span>
        </div>
        <div className="text-3xl font-light text-slate-900 dark:text-slate-100 mb-2">{stats.avgPercentile}<span className="text-sm sm:text-lg text-slate-400 dark:text-slate-500 ml-1">%</span></div>
        <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-1.5 overflow-hidden flex shadow-inner">
          <div className="avg-percentile-bar h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, (Number(stats.avgPercentile) / goalPercentile) * 100 || 0))}%` }}></div>
        </div>
        <div className="flex justify-end w-full mt-1.5">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-0.5 group">
            Goal: 
            <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" type="text" maxLength={3} value={goalPercentileStr} onChange={(e) => setGoalPercentileStr(e.target.value.replace(/[^0-9]/g, ''))} onBlur={() => !goalPercentileStr && setGoalPercentileStr('95')} className="w-6 text-right bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-[10px] leading-none mb-[2px] transition-colors hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer text-slate-600 dark:text-slate-300" />
            %ile
          </div>
        </div>
      </div>

      {/* 3. Avg Accuracy */}
      <div 
        className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden transition-all"
        data-jarvis-stat={`accuracy: ${stats.avgAccuracy}%`}
      >
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 mb-2 mt-1">
          <Target className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <span className="font-medium text-xs sm:text-sm truncate">Avg Accuracy</span>
        </div>
        <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{stats.avgAccuracy}{stats.avgAccuracy !== '-' && <span className="text-sm sm:text-lg text-slate-400 dark:text-slate-500 ml-1">%</span>}</div>
      </div>

      {/* 4. Recent Trend */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
          <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          <span className="font-medium text-xs sm:text-sm truncate">Recent Trend</span>
        </div>
        <div className="flex pb-1 items-end gap-2">
          <span className="text-3xl font-light leading-none text-slate-900 dark:text-slate-100">{stats.recent.score}</span>
          {stats.scoreDiff !== '-' && Number(stats.scoreDiff) !== 0 && (
            <span className={`text-xs font-medium leading-none ${stats.isScoreUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.isScoreUp ? '+' : ''}{stats.scoreDiff}
            </span>
          )}
        </div>
      </div>

      {/* 5. Total Tests */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-amber-500">
         <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
          <CalendarDays className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <span className="font-medium text-xs sm:text-sm truncate">Total Tests</span>
        </div>
        <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{stats.totalTests}</div>
      </div>

      {/* 6. Leaderboard Position */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm border-l-4 border-l-purple-500">
         <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
          <Trophy className="w-5 h-5 text-purple-500 dark:text-purple-400" />
          <span className="font-medium text-xs sm:text-sm truncate">Rank</span>
        </div>
        <div className="text-3xl font-light text-slate-900 dark:text-slate-100">{leaderboardRank ? `#${leaderboardRank}` : '-'}</div>
      </div>
      
    </div>
  );
};
