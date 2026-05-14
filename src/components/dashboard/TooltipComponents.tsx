import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MockScore } from '../../types';
import { getHeatmapColor } from '../../lib/utils';

export const PortalContent = ({ chartRefBox, coordinate, content, screenX, screenY, isRight, isBottom }: any) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el || !chartRefBox.current || !coordinate) return;
    
    let animationFrameId: number;
    
    const updatePosition = () => {
       if (chartRefBox.current && tooltipRef.current && coordinate) {
          const r = chartRefBox.current.getBoundingClientRect();
          const pointX = r.left + coordinate.x;
          const pointY = r.top + coordinate.y;
          
          const w = tooltipRef.current.offsetWidth;
          const h = tooltipRef.current.offsetHeight;
          
          let leftPos = pointX + 10;
          let topPos = pointY + 10;

          if (leftPos + w > window.innerWidth - 10) {
             leftPos = pointX - w - 10;
          }
          if (leftPos < 10) {
             leftPos = 10;
          }
          
          if (topPos + h > window.innerHeight - 10) {
             topPos = pointY - h - 10;
          }
          const minTop = document.querySelector('header')?.getBoundingClientRect().height || 64;
          if (topPos < minTop + 10) {
             topPos = minTop + 10;
          }
          
          tooltipRef.current.style.left = `${leftPos}px`;
          tooltipRef.current.style.top = `${topPos}px`;
          tooltipRef.current.style.transform = `none`;
          tooltipRef.current.style.opacity = '1';
       }
       animationFrameId = requestAnimationFrame(updatePosition);
    };
    
    animationFrameId = requestAnimationFrame(updatePosition);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [chartRefBox, coordinate]);

  return createPortal(
    <div 
      ref={tooltipRef}
      className="fixed z-40 pointer-events-none transition-opacity duration-75 ease-out opacity-100"
      style={{ left: screenX, top: screenY, opacity: 0 }} // Start invisible until first JS update
    >
      {content}
    </div>,
    document.body
  );
};


export const CustomTooltip = ({ active, payload, coordinate, chartRefBox, activeTrendId, subjects, getSub }: any) => {
  const [visible, setVisible] = useState(false);
  const [lastTrend, setLastTrend] = useState(activeTrendId);
  
  const payloadId = payload?.[0]?.payload?.id || payload?.[0]?.payload?.mockName;
  const coordX = coordinate?.x;
  const coordY = coordinate?.y;

  useEffect(() => {
    if (activeTrendId !== lastTrend) {
      setVisible(false);
      setLastTrend(activeTrendId);
    } else {
      if (active) setVisible(true);
      else setVisible(false);
    }
  }, [active, payloadId, coordX, coordY, activeTrendId, lastTrend]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setVisible(false);
    };

    if (visible && active) {
      // Small timeout so the trigger click doesn't immediately close it
      const timer = setTimeout(() => {
        document.addEventListener('touchstart', handleOutsideClick);
        document.addEventListener('mousedown', handleOutsideClick);
      }, 50);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('touchstart', handleOutsideClick);
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }
  }, [visible, active]);

  if (active && visible && payload && payload.length) {
    const data = payload[0].payload as MockScore;
    
    const content = (
      <div 
        className="bg-slate-900 border border-slate-700 text-white p-3 sm:p-4 rounded-xl shadow-2xl text-[13px] sm:text-sm min-w-[200px] sm:min-w-[220px] max-w-[calc(100vw-20px)] sm:max-w-[320px] overflow-hidden relative z-40 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <p className="font-semibold text-slate-100 mb-1.5">{data.mockName || 'Mock Test'}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md text-slate-300 font-medium">{data.examType}</span>
          {data.examRole && <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded-md text-indigo-300 font-medium">{data.examRole}</span>}
          {data.examPhase && <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-md text-amber-300 font-medium">{data.examPhase}</span>}
          {data.examScope && <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded-md text-emerald-300 font-medium">{data.examScope}</span>}
        </div>
        <div className="space-y-1.5 border-t border-slate-800 pt-3 mt-3">
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">Percentile</span>
            <span className="font-mono font-bold text-emerald-400">{data.percentile || '-'}%</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">Overall Score</span>
            <span className="font-mono font-bold text-blue-400">{data.score || '-'}</span>
          </div>
          {subjects && subjects.some((s: any) => getSub(data, s.id)?.score) ? (
            <>
              <div className="border-t border-slate-800 my-1.5" />
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-2">Sectional Scores</div>
              {subjects.map((s: any) => {
                const subData = getSub(data, s.id);
                if (!subData?.score) return null;
                return (
                  <div key={s.id} className="flex justify-between items-center gap-4">
                    <span className="text-slate-300 text-xs">{s.short || s.name}</span>
                    <span className="font-mono text-slate-100 font-medium text-xs">
                      <span className={`text-[9px] font-bold px-1 rounded-sm mr-2 ${getHeatmapColor(subData.percentile || 0)}`}>{subData.percentile || '-'}%</span>
                      {subData.score}
                    </span>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      </div>
    );

    if (chartRefBox && chartRefBox.current && coordinate && typeof document !== 'undefined') {
      const rect = chartRefBox.current.getBoundingClientRect();
      const screenX = rect.left + coordinate.x;
      const screenY = rect.top + coordinate.y;
      const isRight = screenX > window.innerWidth / 2;
      const isBottom = screenY > window.innerHeight / 2;

      return <PortalContent chartRefBox={chartRefBox} coordinate={coordinate} content={content} screenX={screenX} screenY={screenY} isRight={isRight} isBottom={isBottom} />;
    }

    return content;
  }
  return null;
};

