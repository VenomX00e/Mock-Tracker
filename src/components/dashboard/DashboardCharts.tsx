import { Card } from '../ui/Card';
import React, { useRef } from 'react';
import { Trophy, TrendingUp, Target } from 'lucide-react';
import { CustomDropdown } from '../CustomDropdown';
import { CustomTooltip } from './TooltipComponents';
import { PercentileChart } from './PercentileChart';
import { SubjectPerformanceChart } from './SubjectPerformanceChart';
import { useDeferredRender } from '../../hooks/useDeferredRender';

interface DashboardChartsProps {
  activeTrendId: string;
  setActiveTrendId: (val: string) => void;
  selectedTrendPeriod: string;
  setSelectedTrendPeriod: (val: string) => void;
  subjects: any[];
  chartView: 'bar' | 'radar';
  setChartView: (val: 'bar' | 'radar') => void;
  activeTrendFilteredChronologicalMocks: any[];
  overallTrendAveragesData: any;
  averageTrendLineValue: number | undefined;
  flattenedData: any[];
  displayedMocks: any[];
  stats: any;
  getSub: (m: any, id: string, subjects: any[]) => any;
  getSubjectColor: (id: string, subjects: any[]) => string;
  parseLocalDate: (str: string) => Date;
}

export const renderCustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined || value === '') return null;
  const scoreY = Math.max(y - 8, 16);
  return (
    <text x={x + width / 2} y={scoreY} className="fill-slate-700 dark:fill-slate-200" fontSize="11" fontWeight="bold" textAnchor="middle">{value}</text>
  );
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  activeTrendId,
  setActiveTrendId,
  selectedTrendPeriod,
  setSelectedTrendPeriod,
  subjects,
  chartView,
  setChartView,
  activeTrendFilteredChronologicalMocks,
  overallTrendAveragesData,
  averageTrendLineValue,
  flattenedData,
  displayedMocks,
  stats,
  getSub,
  getSubjectColor,
  parseLocalDate
}) => {
  const lineChartRefInner = useRef<HTMLDivElement>(null);
  const barChartRefInner = useRef<HTMLDivElement>(null);
  const radarChartRefInner = useRef<HTMLDivElement>(null);
  
  const okToRenderCharts = useDeferredRender(50);

  const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const entry = flattenedData[payload.value];
    if (!entry) return null;
    
    if (entry.isGap) return null;
  
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={0} 
          y={0} 
          dy={12} 
          textAnchor="middle" 
          fill="#64748b" 
          fontSize={11}
          fontWeight={500}
        >
          {entry.shortName}
        </text>
      </g>
    );
  };

  return (
    <div id="performance-trend" className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative scroll-mt-24">
      {/* Chart: Percentile Trend */}
      <Card noPadding className="p-6 flex flex-col min-h-[325px] sm:h-[325px] lg:col-span-2 relative mt-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 lg:mb-2 gap-3 lg:gap-4">
          <div className="flex items-start sm:items-center justify-between w-full lg:w-auto">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-start whitespace-nowrap tracking-tight">
              <Trophy className="w-5 h-5 flex-shrink-0 mr-1.5 text-slate-400 dark:text-slate-500 mt-0.5" /> 
              <div className="flex items-start whitespace-nowrap">
                Performance Trend
                <div className="-mt-1.5 ml-1">
                  <CustomDropdown
                    value={selectedTrendPeriod === 'All' ? 'All' : selectedTrendPeriod.replace(' Days', '')}
                    options={['All', '7', '15', '30', 'Custom']}
                    onChange={(val) => {
                        if (val === 'Custom') setSelectedTrendPeriod('60');
                        else if (val === 'All') setSelectedTrendPeriod('All');
                        else setSelectedTrendPeriod(val + ' Days');
                    }}
                    placeholder="Days"
                    buttonClassName="px-0.5 py-0 text-[10.5px] font-bold text-indigo-500 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700/50 border-none rounded whitespace-nowrap leading-none shadow-none"
                    optionClassName="px-2 py-1 text-xs text-center"
                    hideArrow={true}
                    editable={!['All', '7 Days', '15 Days', '30 Days'].includes(selectedTrendPeriod)}
                  />
                </div>
              </div>
            </h3>
          </div>
          
          <div className="flex overflow-x-auto gap-2 pb-2 lg:pb-0 hide-scrollbar -mx-2 px-2 lg:mx-0 lg:px-0">
            {[{ id: 'overall', name: 'Overall' }, { id: 'full', name: 'Full Exams' }, ...subjects]
              .map((s) => {
              const isActive = activeTrendId === s.id;
              let color = '#6366f1';
              if (s.id === 'full') color = '#ec4899';
              else if (s.id !== 'overall') color = getSubjectColor(s.id, subjects);
              
              return (
                <button 
                  key={s.id} 
                  onClick={() => setActiveTrendId(s.id)}
                  style={{ 
                    backgroundColor: isActive ? `${color}20` : `${color}10`,
                    color: color,
                    borderColor: isActive ? `${color}` : `${color}30`,
                    opacity: isActive ? 1 : 0.65
                  }}
                  className={`text-xs px-2.5 py-1 border rounded-full font-medium transition-all whitespace-nowrap hover:opacity-100 ${isActive ? 'shadow-sm' : ''}`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex-1 w-full mt-4 overflow-hidden relative min-h-[200px] sm:min-h-[250px]">
          {activeTrendFilteredChronologicalMocks.length < 2 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm sm:text-base px-4 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100/50 dark:border-slate-800/50">
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 mb-3 opacity-30 text-indigo-500 dark:text-indigo-400" />
              <div className="font-medium text-slate-600 dark:text-slate-300">Unlock Performance Trend</div>
              <div className="text-xs sm:text-sm mt-1 max-w-xs">Add at least 2 mocks in this period to visualize your progress over time</div>
            </div>
          ) : !okToRenderCharts ? (
            <div className="absolute inset-0 z-0"></div>
          ) : (
            <PercentileChart
              activeTrendId={activeTrendId}
              subjects={subjects}
              activeTrendFilteredChronologicalMocks={activeTrendFilteredChronologicalMocks}
              overallTrendAveragesData={overallTrendAveragesData}
              averageTrendLineValue={averageTrendLineValue}
              getSub={getSub}
              getSubjectColor={getSubjectColor}
              parseLocalDate={parseLocalDate}
            />
          )}
        </div>
      </Card>
      
      {/* Chart: Sectional Scores */}
      <Card noPadding className="p-6 flex flex-col min-h-[325px] sm:h-[325px] lg:col-span-2">
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-6">
           <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center text-sm sm:text-base whitespace-nowrap">
              <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-slate-400 dark:text-slate-500" /> Sectional Breakdown
           </h3>
           <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
              <button 
                onClick={() => setChartView('bar')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === 'bar' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Bar
              </button>
              <button 
                onClick={() => setChartView('radar')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartView === 'radar' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Radar
              </button>
           </div>
        </div>
        {!okToRenderCharts ? (
          <div className="flex-1 min-h-[200px]"></div>
        ) : (
          <SubjectPerformanceChart
            chartView={chartView}
            flattenedData={flattenedData}
            activeTrendId={activeTrendId}
            subjects={subjects}
            displayedMocks={displayedMocks}
            stats={stats}
            getSub={getSub}
            renderCustomTick={renderCustomTick}
          />
        )}
      </Card>
    </div>
  );
};
