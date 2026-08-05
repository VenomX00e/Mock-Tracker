const fs = require('fs');
let code = fs.readFileSync('src/components/dashboard/RecentMocksTable.tsx', 'utf8');

if (!code.includes('useCacheStore')) {
    code = code.replace(/import { getHeatmapColor/, "import { useCacheStore } from '../../store/analyticsStore';\nimport { getHeatmapColor");
    code = code.replace(/const displayedMocks = showRecycleBin \? deletedMocks : activeTrendFilteredMocks;/, `
  const { selectedHistoryDate, updateDashboardCache } = useCacheStore();
  
  let displayedMocks = showRecycleBin ? deletedMocks : activeTrendFilteredMocks;
  
  if (selectedHistoryDate && !showRecycleBin) {
    displayedMocks = displayedMocks.filter(mock => mock.date === selectedHistoryDate);
  }
`);
    code = code.replace(/<div id="history-log" className="flex flex-wrap items-center mt-12 mb-6 gap-3 sm:gap-4 scroll-mt-24">/, `<div id="history-log" className="flex flex-wrap items-center mt-12 mb-6 gap-3 sm:gap-4 scroll-mt-24">
        {selectedHistoryDate && !showRecycleBin && (
           <div className="w-full mb-2">
             <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-sm border border-indigo-100 dark:border-indigo-800/50">
               <CalendarDays className="w-4 h-4" />
               <span>Showing mocks for <strong>{selectedHistoryDate}</strong></span>
               <button onClick={() => updateDashboardCache({ selectedHistoryDate: null })} className="ml-2 hover:text-indigo-900 dark:hover:text-indigo-100 p-0.5 rounded-full hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 transition-colors">
                 <X className="w-3.5 h-3.5" />
               </button>
             </div>
           </div>
        )}`);
        
    if (!code.includes('X, ')) {
        code = code.replace(/BookA } from 'lucide-react';/, "BookA, X } from 'lucide-react';");
    }
    
    fs.writeFileSync('src/components/dashboard/RecentMocksTable.tsx', code);
    console.log("Patched RecentMocksTable.tsx");
} else {
    console.log("Already patched RecentMocksTable.tsx");
}
