import React, { useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell, Tooltip as RechartsTooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { CustomTooltip } from './TooltipComponents';

interface SubjectPerformanceChartProps {
  chartView: 'bar' | 'radar';
  flattenedData: any[];
  activeTrendId: string;
  subjects: any[];
  displayedMocks: any[];
  stats: any;
  getSub: (m: any, id: string, subjects: any[]) => any;
  renderCustomTick: (props: any) => React.ReactNode;
}

export const SubjectPerformanceChart: React.FC<SubjectPerformanceChartProps> = ({
  chartView,
  flattenedData,
  activeTrendId,
  subjects,
  displayedMocks,
  stats,
  getSub,
  renderCustomTick
}) => {
  const barChartRefInner = useRef<HTMLDivElement>(null);
  const radarChartRefInner = useRef<HTMLDivElement>(null);

  if (chartView === 'bar') {
    return (
      <div className="flex-1 w-full relative flex flex-col overflow-hidden">
        <div className="w-full flex-1 overflow-x-auto overflow-y-hidden touch-pan-x touch-pan-y [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div style={{ height: '100%', minWidth: Math.max(flattenedData.length * 28, 400) }} ref={barChartRefInner}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart key={`bar-${activeTrendId}`} style={{ touchAction: 'pan-x' }} data={flattenedData} margin={{ top: 30, right: 20, left: -20, bottom: 5 }} barCategoryGap="0%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.4} />
                <XAxis dataKey="flatIndex" axisLine={false} tickLine={false} interval={0} height={30} tick={renderCustomTick} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <RechartsTooltip content={<CustomTooltip chartRefBox={barChartRefInner} activeTrendId={activeTrendId} subjects={subjects} getSub={(m, id) => getSub(m, id, subjects)} />} isAnimationActive={false} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                
                <Bar dataKey="cellScore" barSize={26} radius={[4, 4, 0, 0]}>
                  {flattenedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isGap ? 'transparent' : entry.fill} />
                  ))}
                  <LabelList dataKey="cellScore" position="top" content={(props: any) => {
                     const { x, y, width, value } = props;
                     if (x == null || y == null || width == null || !value) return null;
                     return (
                       <text x={x + width / 2} y={y - 5} fill="#ffffff" fontSize={10} fontWeight={700} textAnchor="middle">
                         {value > 0 ? value : ''}
                       </text>
                     );
                  }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Custom Legend to prevent scrolling and control order */}
        <div className="flex flex-wrap justify-center gap-4 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
          {subjects.map((s: any, idx: number) => {
             const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
             const hasSub = displayedMocks.some(m => getSub(m, s.id, subjects)?.score != null && getSub(m, s.id, subjects)?.score !== 0);
             if (!hasSub) return null;
             return (
               <div key={s.id} className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }}></div><span className="text-xs font-medium text-slate-600 dark:text-slate-400"><span className="sm:hidden">{s.short || s.name}</span><span className="hidden sm:block">{s.name}</span></span></div>
             );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full relative flex flex-col overflow-hidden">
      <div className="w-full h-full relative min-h-[200px] sm:min-h-[250px]">
        <div className="absolute inset-0 w-full h-full" ref={radarChartRefInner}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            {(() => {
              const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
              const radarData = subjects.filter((s: any) => displayedMocks.some(m => getSub(m, s.id, subjects)?.score != null && getSub(m, s.id, subjects)?.score !== 0)).map((s: any, idx: number) => ({
                subject: s.short || s.name,
                value: Number(stats?.subjectAverages?.[s.id] || 0).toFixed(1),
                fullMark: 100,
                color: colors[idx % colors.length]
              }));
              return (
                <RadarChart key={`radar-${activeTrendId}`} cx="50%" cy="50%" outerRadius="65%" margin={{ top: 20, right: 30, bottom: 20, left: 30 }} data={radarData}>
                  <PolarGrid stroke="#64748b" strokeOpacity={0.4} />
                  <PolarAngleAxis dataKey="subject" tick={(props: any) => { 
                    const { payload, x, y, textAnchor, index } = props; 
                    const dy = y < 150 ? -14 : 24;
                    return <text x={x} y={y} dy={dy} fill={radarData[index]?.color || '#64748b'} fontSize={13} fontWeight={600} textAnchor={textAnchor}>{payload.value}</text>; 
                  }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} tickCount={6} />
                  <Radar name="Percentile" dataKey="value" stroke="#ec4899" strokeWidth={2} fill="#ec4899" fillOpacity={0.3} dot={{ r: 3, fill: '#ec4899' }} activeDot={{ r: 5 }} label={(props: any) => { 
                    const { x, y, value, index } = props; 
                    const dyVal = y < 150 ? 12 : -8;
                    return <text x={x} y={y} dy={dyVal} fill={radarData[index]?.color || "#ec4899"} fontSize={11} fontWeight={700} textAnchor="middle">{value}%</text>; 
                  }} />
                  <RechartsTooltip content={<CustomTooltip chartRefBox={radarChartRefInner} activeTrendId={activeTrendId} subjects={subjects} getSub={(m, id) => getSub(m, id, subjects)} />} isAnimationActive={false} wrapperStyle={{ visibility: 'hidden' }} allowEscapeViewBox={{ x: false, y: false }} />
                </RadarChart>
              );
            })()}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
