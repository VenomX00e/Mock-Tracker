import React, { useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, ReferenceLine, Label } from 'recharts';
import { CustomTooltip } from './TooltipComponents';

interface PercentileChartProps {
  activeTrendId: string;
  subjects: any[];
  activeTrendFilteredChronologicalMocks: any[];
  overallTrendAveragesData: any;
  averageTrendLineValue: number | undefined;
  getSub: (m: any, id: string, subjects: any[]) => any;
  getSubjectColor: (id: string, subjects: any[]) => string;
  parseLocalDate: (str: string) => Date;
}

export const PercentileChart: React.FC<PercentileChartProps> = ({
  activeTrendId,
  subjects,
  activeTrendFilteredChronologicalMocks,
  overallTrendAveragesData,
  averageTrendLineValue,
  getSub,
  getSubjectColor,
  parseLocalDate
}) => {
  const lineChartRefInner = useRef<HTMLDivElement>(null);

  return (
    <div className="absolute inset-0 h-full w-full" ref={lineChartRefInner}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart key={`line-${activeTrendId}`} data={activeTrendFilteredChronologicalMocks} margin={{ top: 5, right: 20, left: -20, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.4} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} height={40} tickFormatter={(val) => { const d = parseLocalDate(val); return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`; }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(value) => {
            if (activeTrendId === 'overall') {
              for (const avg of overallTrendAveragesData.original) {
                if (Math.abs(value - avg) <= 5) return '';
              }
            } else if (averageTrendLineValue !== undefined && Math.abs(value - averageTrendLineValue) <= 5) {
              return '';
            }
            return String(Math.round(value));
          }} />
          <RechartsTooltip content={<CustomTooltip chartRefBox={lineChartRefInner} activeTrendId={activeTrendId} subjects={subjects} getSub={(m, id) => getSub(m, id, subjects)} />} isAnimationActive={false} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
          {(averageTrendLineValue !== undefined && activeTrendId !== 'overall') && (
            <ReferenceLine y={averageTrendLineValue} stroke="transparent">
              <Label value={`${Math.round(averageTrendLineValue * 10) / 10}`} position="left" fill={(() => {
                if (activeTrendId === 'full') return '#ec4899';
                if (activeTrendId === 'overall') return '#6366f1';
                const sIdx = subjects.findIndex((sub: any) => sub.id === activeTrendId);
                if (sIdx !== -1) {
                  return ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'][sIdx % 6];
                }
                return '#10b981';
              })()} fontSize={12} fontWeight="bold" />
            </ReferenceLine>
          )}
          {activeTrendId === 'overall' ? (
            [{ id: 'full', name: 'Full' }, ...subjects].map((s) => {
               const color = getSubjectColor(s.id, subjects);
               const avgData = overallTrendAveragesData.displayMap[s.id];
               return (
                 <React.Fragment key={s.id}>
                   {avgData !== undefined && (
                     <ReferenceLine y={avgData.display} stroke="transparent">
                       <Label value={`${Math.round(avgData.original * 10) / 10}`} position="left" fill={color} fontSize={12} fontWeight="bold" />
                     </ReferenceLine>
                   )}
                   <Line 
                     connectNulls={true} 
                     type="monotone" 
                     dataKey={(m: any) => {
                       if (s.id === 'full') {
                         if (m.examScope && m.examScope !== 'Full') return null;
                         return m.percentile || m.score;
                       }
                       const v = getSub(m, s.id, subjects);
                       if (!v) return null;
                       return v.percentile || v.score;
                     }} 
                     name={`${s.name} %ile/Score`} 
                     stroke={color} 
                     strokeWidth={s.id === 'full' ? 3 : 2} 
                     dot={{ r: s.id === 'full' ? 4 : 3, strokeWidth: 2, fill: '#fff' }} 
                     activeDot={{ r: s.id === 'full' ? 6 : 5, strokeWidth: 0, fill: color }} 
                   />
                 </React.Fragment>
               );
            })
          ) : (
            <Line connectNulls={true} type="monotone" dataKey={(m: any) => {
                if (activeTrendId === 'full') return m.percentile || m.score;
                const v = getSub(m, activeTrendId, subjects);
                if (!v) return null;
                return v.percentile || v.score;
            }} name={activeTrendId === 'full' ? 'Percentile/Score' : `${activeTrendId} %ile/Score`} stroke={(() => {
                if (activeTrendId === 'full') return '#ec4899';
                const sIdx = subjects.findIndex((sub: any) => sub.id === activeTrendId);
                if (sIdx !== -1) {
                  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                  return colors[sIdx % colors.length];
                }
                return '#6366f1';
            })()} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={(() => {
                 if (activeTrendId === 'full') return { r: 6, strokeWidth: 0, fill: '#ec4899' };
                 const sIdx = subjects.findIndex((sub: any) => sub.id === activeTrendId);
                 const color = sIdx !== -1 ? ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'][sIdx % 6] : '#6366f1';
                 return { r: 6, strokeWidth: 0, fill: color };
            })()} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
