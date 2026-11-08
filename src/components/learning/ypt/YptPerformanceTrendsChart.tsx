import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  YptChallenge,
  YptDailyDaySnapshot,
  YptApiMember,
} from '../../../types/yptTypes';
import {
  getYptDayYmd,
  getChallengeStartDateYmd,
  getChallengeEndDateYmd,
  formatDisplayYmd,
} from '../../../utils/yptUtils';

interface YptPerformanceTrendsChartProps {
  challenge: YptChallenge;
  dailySnapshots: YptDailyDaySnapshot[];
  liveRosterMembers?: YptApiMember[];
  isSoloMode?: boolean;
}

const COLOR_PALETTE = [
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
];

export const YptPerformanceTrendsChart: React.FC<YptPerformanceTrendsChartProps> = ({
  challenge,
  dailySnapshots,
  liveRosterMembers = [],
  isSoloMode = false,
}) => {
  const { chartData, seriesKeys } = useMemo(() => {
    const todayYmd = getYptDayYmd();
    const startYmd = getChallengeStartDateYmd(challenge);
    const endYmd = getChallengeEndDateYmd(challenge);
    const targetEndYmd = todayYmd < endYmd ? todayYmd : endYmd;

    // 1. Build date list
    const datesList: string[] = [];
    const [sY, sM, sD] = startYmd.split('-').map(Number);
    const [eY, eM, eD] = targetEndYmd.split('-').map(Number);
    const curr = new Date(sY, sM - 1, sD);
    const end = new Date(eY, eM - 1, eD);

    // Limit to max 30 days to keep chart performant and legible
    let dayCount = 0;
    while (curr <= end && dayCount < 45) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      datesList.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
      dayCount++;
    }

    // 2. Identify top entities to plot
    let keys: { id: string; label: string; color: string }[] = [];

    if (isSoloMode) {
      // Find top 6 participants overall
      const participantTotals = new Map<string, { handle: string; points: number }>();
      (challenge.participants || []).forEach((p) => {
        const clean = p.yptHandle.replace(/^@/, '').trim().toLowerCase();
        participantTotals.set(clean, { handle: p.yptHandle, points: 0 });
      });

      // Sum from daily snapshots
      dailySnapshots.forEach((snap) => {
        if (snap.memberSnapshots) {
          Object.entries(snap.memberSnapshots).forEach(([handle, mem]) => {
            const clean = handle.replace(/^@/, '').trim().toLowerCase();
            const existing = participantTotals.get(clean);
            if (existing) {
              existing.points += mem.netPoints || 0;
            } else {
              participantTotals.set(clean, { handle: `@${handle}`, points: mem.netPoints || 0 });
            }
          });
        }
      });

      // Sort by highest total points and take top 6
      const sorted = Array.from(participantTotals.values()).sort((a, b) => b.points - a.points);
      const topEntities = sorted.slice(0, 6);

      keys = topEntities.map((ent, idx) => ({
        id: ent.handle.replace(/^@/, '').trim().toLowerCase(),
        label: `@${ent.handle.replace(/^@/, '')}`,
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }));
    } else {
      // Team mode: plot all teams
      keys = (challenge.teams || []).map((t, idx) => ({
        id: t.id,
        label: t.name,
        color: t.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }));
    }

    // 3. Build data point per date with cumulative points
    const cumulativeScoreMap = new Map<string, number>();
    keys.forEach((k) => cumulativeScoreMap.set(k.id, 0));

    const data = datesList.map((dateYmd) => {
      const snap = dailySnapshots.find((s) => s.targetDateYmd === dateYmd);
      const row: Record<string, any> = {
        date: dateYmd,
        displayDate: formatDisplayYmd(dateYmd, { month: 'short', day: 'numeric' }),
      };

      if (isSoloMode) {
        keys.forEach((k) => {
          let dayPoints = 0;
          if (snap && snap.memberSnapshots && snap.memberSnapshots[k.id]) {
            dayPoints = snap.memberSnapshots[k.id].netPoints || 0;
          }
          const prev = cumulativeScoreMap.get(k.id) || 0;
          const newCum = prev + dayPoints;
          cumulativeScoreMap.set(k.id, newCum);
          row[k.id] = newCum;
        });
      } else {
        keys.forEach((k) => {
          let dayPoints = 0;
          if (snap && snap.teamStandings) {
            const teamStand = snap.teamStandings.find((ts) => ts.teamId === k.id);
            if (teamStand) {
              dayPoints = teamStand.dayPoints || 0;
            }
          }
          const prev = cumulativeScoreMap.get(k.id) || 0;
          const newCum = prev + dayPoints;
          cumulativeScoreMap.set(k.id, newCum);
          row[k.id] = newCum;
        });
      }

      return row;
    });

    return { chartData: data, seriesKeys: keys };
  }, [challenge, dailySnapshots, liveRosterMembers, isSoloMode]);

  if (chartData.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
        No performance history logs recorded yet to render trend lines.
      </div>
    );
  }

  return (
    <div className="bg-slate-50/70 dark:bg-slate-950/60 p-3.5 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <span>📈</span> {isSoloMode ? 'Top Participants Cumulative XP Trajectory' : 'Team XP Progression Trajectory'}
        </h4>
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          Cumulative net points over time
        </span>
      </div>

      <div className="w-full h-56 sm:h-64 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#cbd5e1', opacity: 0.3 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '11px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ fontWeight: 'bold', color: '#cbd5e1', marginBottom: '4px' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
              iconType="circle"
              iconSize={8}
            />
            {seriesKeys.map((series) => (
              <Line
                key={series.id}
                type="monotone"
                dataKey={series.id}
                name={series.label}
                stroke={series.color}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: series.color }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 1.5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
