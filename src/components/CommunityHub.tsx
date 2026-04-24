import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile, MockScore } from '../types';
import { Trophy, Flame, Target, Users, Calendar, ArrowRight } from 'lucide-react';
import { getHeatmapColor, getPlatformShort } from '../lib/utils';
import { CustomDropdown } from './CustomDropdown';

export default function CommunityHub({ 
  onCopyMock,
  onUserClick
}: { 
  onCopyMock?: (mock: MockScore) => void;
  onUserClick?: (profile: any) => void;
}) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserProfile, direction: 'asc'|'desc' }>({ key: 'avgPercentile', direction: 'desc' });
  const [feedLogs, setFeedLogs] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [daysVisible, setDaysVisible] = useState(1);
  const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});

  // Fetch Leaderboard and Users
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('avgPercentile', 'desc'));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => d.data() as UserProfile);
        
        // Filter out banned/muted users from leaderboard
        const visibleUsers = users.filter((u) => !u.isBanned && !u.isMuted);
        
        const map: Record<string, UserProfile> = {};
        users.forEach(u => map[u.userId] = u);
        setUserMap(map);

        setAllUsers(visibleUsers.filter(u => u.totalTests > 0));
      } catch (e) {
        console.error(e);
      }
      setLoadingTop(false);
    };
    fetchLeaderboard();
  }, []);

  // Fetch Feed
  useEffect(() => {
    const fetchFeed = async () => {
      if (Object.keys(userMap).length === 0) return; // Wait for users to load
      setLoadingFeed(true);
      try {
        const q = query(collectionGroup(db, 'mocks'), orderBy('date', 'desc'), limit(200));
        const snap = await getDocs(q);
        
        let mocks = snap.docs.map(d => d.data() as MockScore);
        
        // Filter out mocks from banned or muted users
        mocks = mocks.filter(m => {
           const p = userMap[m.userId!];
           if (!p) return true;
           if (p.isBanned || p.isMuted) return false;
           return true;
        });

        // Group by Date -> ExamName -> Mocks (sorted by percentile)
        const grouped: any = {};
        const profileToMocksMap: Record<string, MockScore[]> = {};
        
        mocks.forEach(m => {
          if (!profileToMocksMap[m.userId!]) profileToMocksMap[m.userId!] = [];
          profileToMocksMap[m.userId!].push(m);
           
          const mockDate = new Date(m.date);
          const dateStr = mockDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
          if (!grouped[dateStr]) grouped[dateStr] = {};
          if (!grouped[dateStr][m.mockName]) grouped[dateStr][m.mockName] = [];
          
          const profile = userMap[m.userId!] || {};
          
          let calculatedStreak = m.streakAtTime;
          if (calculatedStreak === undefined) {
              calculatedStreak = profile.streak || 0;
              if (profile.lastMockDate && profile.streak > 0) {
                 const mockD = new Date(mockDate.getFullYear(), mockDate.getMonth(), mockDate.getDate());
                 const lastD = new Date(new Date(profile.lastMockDate).getFullYear(), new Date(profile.lastMockDate).getMonth(), new Date(profile.lastMockDate).getDate());
                 const daysDiff = Math.round((lastD.getTime() - mockD.getTime()) / (1000 * 3600 * 24));
                 if (daysDiff >= 0 && daysDiff < profile.streak) {
                    calculatedStreak = profile.streak - daysDiff;
                 }
              }
          }
          if (!calculatedStreak || calculatedStreak <= 0) {
              calculatedStreak = 1;
          }

          grouped[dateStr][m.mockName].push({
             ...m,
             userName: profile.displayName || (m as any).userName || 'Anonymous',
             userStreak: calculatedStreak,
             userStreakActive: true,
             userPhoto: profile.photoURL || `https://ui-avatars.com/api/?name=${(m as any).userName || 'A'}`,
             userProfileRef: { ...profile, todaysMocks: profileToMocksMap[m.userId!].filter(tm => new Date(tm.date).toDateString() === new Date().toDateString()) }
          });
        });

        // Convert to array format
        const finalFeed = [];
        for (const date of Object.keys(grouped).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())) {
          const examsObj = grouped[date];
          const examsArray = [];
          for (const examName of Object.keys(examsObj)) {
            // Sort mocks inside exam by percentile desc
            const sortedMocks = examsObj[examName].sort((a: MockScore, b: MockScore) => b.percentile - a.percentile);
            // Calculate earliest time of this exam to sort exams later
            const earliestTime = Math.min(...sortedMocks.map((m: MockScore) => new Date(m.date).getTime()));
            examsArray.push({ examName, mocks: sortedMocks, earliestTime });
          }
          // Sort exams by earliest time descending (recent first, meaning first exam of the day is last) 
          examsArray.sort((a, b) => b.earliestTime - a.earliestTime);
          
          const universalRows = [];
          for (const eg of examsArray) {
             universalRows.push(...eg.mocks);
          }
          finalFeed.push({ date, mocks: universalRows });
        }
        setFeedLogs(finalFeed);
      } catch (e) {
        console.error(e);
      }
      setLoadingFeed(false);
    };
    fetchFeed();
  }, [daysVisible, userMap]);

  const handleSort = (key: keyof UserProfile) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedLeaderboard = [...allUsers].sort((a, b) => {
    const aVal = a[sortConfig.key] || 0;
    const bVal = b[sortConfig.key] || 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-8 mt-12 mb-12">
      {/* LEADERBOARD */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard
          </h3>
        </div>
        <div className="overflow-x-auto">
          {loadingTop ? (
            <div className="p-8 text-center text-slate-400">Loading Leaderboard...</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-semibold text-center hidden sm:table-cell">Rank</th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('displayName')}>Aspirant {sortConfig.key === 'displayName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('avgPercentile')}>Avg %ile {sortConfig.key === 'avgPercentile' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('avgQuantPercentile')}>Quant {sortConfig.key === 'avgQuantPercentile' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('avgReasoningPercentile')}>Reasoning {sortConfig.key === 'avgReasoningPercentile' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('avgEnglishPercentile')}>English {sortConfig.key === 'avgEnglishPercentile' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('totalTests')}>Tests {sortConfig.key === 'totalTests' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('streak')}>Streak {sortConfig.key === 'streak' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedLeaderboard.map((user, idx) => (
                  <tr key={user.userId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-400 text-center hidden sm:table-cell">#{idx + 1}</td>
                    <td className="p-4">
                      <div 
                         className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition-colors inline-flex"
                         onClick={() => {
                            if (onUserClick) {
                               onUserClick({ ...user, leaderboardRank: idx + 1 });
                            }
                         }}
                      >
                        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full bg-slate-200" />
                        <div>
                          <div className="font-semibold text-slate-800">{user.displayName}</div>
                          <div className="text-[10px] text-slate-500">{user.targetedExam}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-medium"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgPercentile)}`}>{user.avgPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgQuantPercentile)}`}>{user.avgQuantPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgReasoningPercentile)}`}>{user.avgReasoningPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600"><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${getHeatmapColor(user.avgEnglishPercentile)}`}>{user.avgEnglishPercentile}%</span></td>
                    <td className="p-4 text-center font-mono text-slate-600">{user.totalTests}</td>
                    <td className="p-4 text-center text-amber-500 font-medium flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4" /> {user.streak}
                    </td>
                  </tr>
                ))}
                {sortedLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">No data available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FEED */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Community Log
          </h3>
        </div>
        <div className="p-4 bg-slate-50">
          {loadingFeed ? (
            <div className="p-8 text-center text-slate-400">Loading community logs...</div>
          ) : (
            <div className="space-y-8">
              {feedLogs.slice(0, daysVisible).map((dayGroup, idx) => (
                <div key={dayGroup.date} className="animate-in fade-in slide-in-from-bottom-2">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" /> {dayGroup.date}
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                              <th className="px-4 py-3 font-semibold">Aspirant</th>
                              <th className="px-4 py-3 font-semibold">Mock Name</th>
                              <th className="px-4 py-3 font-semibold text-center">Exam</th>
                              <th className="px-4 py-3 font-semibold text-center">Score</th>
                              <th className="px-4 py-3 font-semibold text-center">Percentile</th>
                              <th className="px-4 py-3 font-semibold text-center">Quant</th>
                              <th className="px-4 py-3 font-semibold text-center">Reasoning</th>
                              <th className="px-4 py-3 font-semibold text-center">English</th>
                              <th className="px-4 py-3 font-semibold text-center">GA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {dayGroup.mocks.map((m: MockScore, mIdx: number) => (
                              <tr 
                                key={m.id} 
                                className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                                onClick={() => onCopyMock && onCopyMock(m)}
                                title="Add this mock score to your dashboard"
                              >
                                <td className="px-4 py-3 font-medium text-slate-700">
                                  <div 
                                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg transition-colors inline-flex"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rank = sortedLeaderboard.findIndex(u => u.userId === m.userId) + 1;
                                        if (onUserClick && (m as any).userProfileRef) {
                                            onUserClick({ ...(m as any).userProfileRef, leaderboardRank: rank > 0 ? rank : undefined });
                                        }
                                    }}
                                  >
                                    <img src={(m as any).userPhoto} alt="" className="w-6 h-6 rounded-full border border-slate-200" />
                                    <span>{(m as any).userName}</span>
                                    {(m as any).userStreak > 0 && (
                                       <span className={`flex items-center ml-1 ${(m as any).userStreakActive ? 'text-amber-500' : 'text-slate-300'}`}>
                                         <Flame className={`w-3 h-3 ${(m as any).userStreakActive ? 'animate-pulse' : ''}`} /> {(m as any).userStreak}
                                       </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-800">{m.mockName}</span>
                                    <div className="flex gap-1.5 mt-1">
                                      {m.platform && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-purple-50 text-purple-600 font-medium">{getPlatformShort(m.platform)}</span>}
                                      {m.examPhase && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-600 font-medium">{m.examPhase}</span>}
                                      {m.examScope && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600 font-medium">{m.examScope}</span>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md text-xs font-semibold">
                                     {m.examType}
                                    </span>
                                    {m.examRole && <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-600 font-medium">{m.examRole}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-medium text-blue-600 text-center align-middle">
                                  {m.score != null && m.score !== 0 ? m.score : '-'}
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                  <div className="flex flex-col items-center gap-1">
                                    {m.percentile != null && m.percentile !== 0 ? (
                                      <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-medium rounded ${getHeatmapColor(m.percentile)}`}>
                                        {m.percentile}%P
                                      </span>
                                    ) : <span className="text-slate-300">-</span>}
                                    {m.accuracy != null && m.accuracy !== 0 && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-medium ${getHeatmapColor(m.accuracy)}`}>
                                        {m.accuracy}%A
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                   <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600">{m.quant?.score != null && m.quant.score !== 0 ? m.quant.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.quant?.percentile != null && m.quant.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.quant.percentile)}`}>{m.quant.percentile}%P</span>}
                                        {m.quant?.accuracy != null && m.quant.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.quant.accuracy)}`}>{m.quant.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600">{m.reasoning?.score != null && m.reasoning.score !== 0 ? m.reasoning.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.reasoning?.percentile != null && m.reasoning.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.reasoning.percentile)}`}>{m.reasoning.percentile}%P</span>}
                                        {m.reasoning?.accuracy != null && m.reasoning.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.reasoning.accuracy)}`}>{m.reasoning.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600">{m.english?.score != null && m.english.score !== 0 ? m.english.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.english?.percentile != null && m.english.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.english.percentile)}`}>{m.english.percentile}%P</span>}
                                        {m.english?.accuracy != null && m.english.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.english.accuracy)}`}>{m.english.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                    <div className="flex flex-col items-center">
                                      <span className="font-mono text-slate-600">{m.ga?.score != null && m.ga.score !== 0 ? m.ga.score : '-'}</span>
                                      <div className="flex flex-col gap-0.5 mt-1 items-center">
                                        {m.ga?.percentile != null && m.ga.percentile !== 0 && <span className={`text-xs font-medium px-1.5 rounded ${getHeatmapColor(m.ga.percentile)}`}>{m.ga.percentile}%P</span>}
                                        {m.ga?.accuracy != null && m.ga.accuracy !== 0 && <span className={`text-[9px] font-medium px-1.5 rounded ${getHeatmapColor(m.ga.accuracy)}`}>{m.ga.accuracy}%A</span>}
                                      </div>
                                    </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {daysVisible < feedLogs.length && (
                <div className="text-center pt-4">
                  <button 
                    onClick={() => setDaysVisible(prev => prev + 5)}
                    className="inline-flex items-center px-5 py-2.5 bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                  >
                    View Next {Math.min(5, feedLogs.length - daysVisible)} Days <ArrowRight className="w-4 h-4 ml-1.5" />
                  </button>
                </div>
              )}
              {feedLogs.length === 0 && (
                 <div className="text-center text-slate-400 py-4">No community data yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
