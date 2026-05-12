import React, { useRef, useState, useEffect } from 'react';
import { useSystemDataCtx, useAppStateCtx } from '../../context/AppContext';
import { useUIStore } from '../../store/uiStore';
import { CountdownCard } from '../CountdownCard';
import { ChevronRight } from 'lucide-react';
import { AllCountdownsModal } from './AllCountdownsModal';

export function CountdownsSection() {
  const { countdowns, pinnedCountdowns, selectedCategory, togglePin } = useSystemDataCtx();
  const { activeTab, setAdminEditCountdown, setAdminTab, setIsAdminModalOpen } = useUIStore();
  const { adminPermissions } = useAppStateCtx();

  const [tappedCountdownId, setTappedCountdownId] = useState<string | null>(null);
  const [isAllOpen, setIsAllOpen] = useState(false);
  const countdownsRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date().getTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (activeTab !== 'dashboard' || countdowns.length === 0) {
    return null;
  }

  const filteredCountdowns = [...countdowns]
    .filter(c => c.categoryId === selectedCategory || (!c.categoryId && selectedCategory === 'banking'))
    .sort((a, b) => {
      const aIdx = pinnedCountdowns.indexOf(a.id);
      const bIdx = pinnedCountdowns.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  if (filteredCountdowns.length === 0) return null;

  return (
    <div className="relative mb-6">
      <button 
        onClick={() => setIsAllOpen(true)}
        className="absolute top-1/2 -translate-y-1/2 -right-2 md:-right-4 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-600 dark:text-slate-300 p-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        title="View All Countdowns"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div ref={countdownsRef} className="flex gap-3 overflow-x-auto custom-scrollbar snap-x" style={{ paddingBottom: '0px' }}>
        {filteredCountdowns.map(c => (
          <CountdownCard
            key={c.id}
            countdown={c}
            now={now}
            tappedCountdownId={tappedCountdownId}
            setTappedCountdownId={setTappedCountdownId}
            isPinned={pinnedCountdowns.includes(c.id)}
            canManageCountdowns={adminPermissions?.canManageCountdowns || false}
            togglePin={togglePin}
            setAdminEditCountdown={setAdminEditCountdown}
            setAdminTab={setAdminTab}
            setIsAdminModalOpen={setIsAdminModalOpen}
          />
        ))}
      </div>

      {isAllOpen && (
        <AllCountdownsModal 
          countdowns={filteredCountdowns}
          now={now}
          onClose={() => setIsAllOpen(false)}
          tappedCountdownId={tappedCountdownId}
          setTappedCountdownId={setTappedCountdownId}
          pinnedCountdowns={pinnedCountdowns}
          canManageCountdowns={adminPermissions?.canManageCountdowns || false}
          togglePin={togglePin}
          setAdminEditCountdown={setAdminEditCountdown}
          setAdminTab={setAdminTab}
          setIsAdminModalOpen={setIsAdminModalOpen}
        />
      )}
    </div>
  );
}
