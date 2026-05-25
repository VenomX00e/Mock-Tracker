import React, { useMemo } from 'react';
import { parseLocalDate } from '../../lib/utils';
import { getSub } from '../../lib/subjectUtils';

interface DashboardInsightsProps {
  chronologicalMocks: any[];
  recentMocks: any[];
  subjects: any[];
  pendingTasksCount: number;
  setActiveTab: (tab: string) => void;
}

export const DashboardInsights: React.FC<DashboardInsightsProps> = ({
  chronologicalMocks,
  recentMocks,
  subjects,
  pendingTasksCount,
  setActiveTab
}) => {
  const result = useMemo(() => {
    if (recentMocks.length === 0) return null;

    // 1. Trend Analysis
    // We want to see if the newest mock is better than the oldest mock in this recent batch
    const recentPercentiles = recentMocks.filter(m => m.percentile != null && m.percentile > 0).map(m => m.percentile).reverse();
    const isImproving = recentPercentiles.length >= 2 && recentPercentiles[recentPercentiles.length - 1] >= recentPercentiles[0];
    const trendIcon = isImproving ? "📈" : "📉";

    // 2. Section Balance
    const secStats: Record<string, number[]> = {};
    subjects.forEach((s: any) => secStats[s.id] = []);
    
    recentMocks.forEach(m => {
       subjects.forEach((s: any) => {
         const perc = getSub(m, s.id, subjects)?.percentile;
         if (perc != null && perc > 0) secStats[s.id].push(perc);
       });
    });

    const sectionAverages = Object.entries(secStats).map(([id, scores]) => {
       const subj = subjects.find((s: any) => s.id === id);
       return {
         name: subj?.name || id,
         avg: scores.length > 0 ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0
       };
    }).filter(s => s.avg > 0).sort((a, b) => b.avg - a.avg);

    const strongest = sectionAverages.length > 0 ? sectionAverages[0] : null;
    const weakest = sectionAverages.length > 1 ? sectionAverages[sectionAverages.length - 1] : null;
    
    // 3. Last Attempt Activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastMockDate = parseLocalDate(recentMocks[0].date);
    lastMockDate.setHours(0, 0, 0, 0);
    
    const msSinceLast = today.getTime() - lastMockDate.getTime();
    const daysSinceLast = Math.max(0, Math.floor(msSinceLast / (1000 * 60 * 60 * 24)));
    
    let consistCardBg = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600";
    let consistHeaderColor = "text-slate-500 dark:text-slate-400";
    let consistIcon = "⏳";
    let streakMessage = "";

    if (daysSinceLast === 0) {
        consistCardBg = "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
        consistHeaderColor = "text-emerald-700 dark:text-emerald-400";
        consistIcon = "🔥";
        streakMessage = "You took a mock today! Great job maintaining the streak.";
    } else if (daysSinceLast <= 2) {
        consistCardBg = "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600";
        consistHeaderColor = "text-blue-700 dark:text-blue-400";
        consistIcon = "💡";
        streakMessage = `It's been ${daysSinceLast} ${daysSinceLast === 1 ? 'day' : 'days'}. Give a mock today to stay consistent!`;
    } else if (daysSinceLast <= 4) {
        consistCardBg = "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600";
        consistHeaderColor = "text-amber-700 dark:text-amber-400";
        consistIcon = "⚠️";
        streakMessage = `It's been ${daysSinceLast} days without a mock. Stop slacking and give a mock today!`;
    } else if (daysSinceLast <= 7) {
        consistCardBg = "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600";
        consistHeaderColor = "text-orange-700 dark:text-orange-400";
        consistIcon = "🚨";
        streakMessage = `${daysSinceLast} days without practice? Your competition is getting ahead while you procrastinate. Take a mock now!`;
    } else {
        consistCardBg = "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600";
        consistHeaderColor = "text-rose-700 dark:text-rose-400";
        consistIcon = "💀";
        streakMessage = `${daysSinceLast} days?! Are you even preparing for the exam anymore? Complete a mock immediately, excuses won't clear the cutoff!`;
    }

    let taskCardBg = "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
    let taskHeaderColor = "text-emerald-700 dark:text-emerald-400";
    let taskIcon = "🎉";
    let taskMessage = "";

    if (pendingTasksCount === 0) {
        taskCardBg = "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
        taskHeaderColor = "text-emerald-700 dark:text-emerald-400";
        taskIcon = "🎉";
        taskMessage = "0 pending tasks! Great job maintaining a clean backlog.";
    } else if (pendingTasksCount <= 4) {
        taskCardBg = "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600";
        taskHeaderColor = "text-blue-700 dark:text-blue-400";
        taskIcon = "📝";
        taskMessage = `Only ${pendingTasksCount} pending ${pendingTasksCount === 1 ? 'task' : 'tasks'}. Finish them soon before they pile up!`;
    } else if (pendingTasksCount <= 7) {
        taskCardBg = "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600";
        taskHeaderColor = "text-amber-700 dark:text-amber-400";
        taskIcon = "⚠️";
        taskMessage = `${pendingTasksCount} pending tasks. Stop pushing them to tomorrow and clear your plate!`;
    } else if (pendingTasksCount <= 10) {
        taskCardBg = "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600";
        taskHeaderColor = "text-orange-700 dark:text-orange-400";
        taskIcon = "🚨";
        taskMessage = `${pendingTasksCount} pending tasks! Your backlog is getting out of hand. Clear them down before adding any more.`;
    } else {
        taskCardBg = "bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600";
        taskHeaderColor = "text-rose-700 dark:text-rose-400";
        taskIcon = "💀";
        taskMessage = `${pendingTasksCount} tasks pending?! Are you just collecting tasks for a museum? Complete your tasks immediately!`;
    }

    return {
      trendIcon, isImproving, strongest, weakest, consistCardBg, consistIcon, consistHeaderColor, streakMessage,
      taskCardBg, taskHeaderColor, taskIcon, taskMessage
    };
  }, [recentMocks, subjects, pendingTasksCount]);

  if (chronologicalMocks.length < 2) {
    return (
      <div className="col-span-full p-6 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        Take at least 2 mocks to generate insights.
      </div>
    );
  }

  if (!result) return null;

  return (
    <>
      <div 
         onClick={() => { setActiveTab('tasks'); window.scrollTo(0, 0); }}
         className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group transition-all cursor-pointer hover:shadow-md ${result.taskCardBg}`}
      >
         <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{result.taskIcon}</div>
         <h4 className={`text-sm font-semibold ${result.taskHeaderColor}`}>Action Required</h4>
         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
            {result.taskMessage}
         </p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
         <div className="text-3xl mb-2">{result.trendIcon}</div>
         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Recent Trend (Last 5)</h4>
         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium">
            {result.isImproving ? "Your percentiles are trending up!" : "Your percentiles are trending down. Time to review!"}
         </p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:border-fuchsia-300 dark:hover:border-fuchsia-600 transition-colors">
         <div className="text-3xl mb-2">⚖️</div>
         <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Section Balance</h4>
         <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 font-medium truncate">
             <div><span className="font-semibold text-emerald-600 dark:text-emerald-400">💪 Best:</span> {result.strongest ? `${result.strongest.name} (~${Math.round(result.strongest.avg)}%ile)` : "N/A"}</div>
             <div className="mt-1"><span className="font-semibold text-rose-600 dark:text-rose-400">🎯 Focus:</span> {result.weakest ? `${result.weakest.name} (~${Math.round(result.weakest.avg)}%ile)` : "N/A"}</div>
         </div>
      </div>
      
      <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group transition-colors ${result.consistCardBg}`}>
         <div className="text-3xl mb-2">{result.consistIcon}</div>
         <h4 className={`text-sm font-semibold ${result.consistHeaderColor}`}>Consistency</h4>
         <p className="mt-1 text-slate-800 dark:text-slate-100 font-medium">
            {result.streakMessage}
         </p>
      </div>
    </>
  );
};
