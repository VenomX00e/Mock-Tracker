import { useState } from 'react';
import { collectionGroup, collection, getDocs, writeBatch, query, orderBy, limit } from 'firebase/firestore';
import { deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';

export function AdminMigrationTool() {
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [yptCleanupLoading, setYptCleanupLoading] = useState(false);
  const [result, setResult] = useState('');
  const [activityResult, setActivityResult] = useState('');
  const [yptCleanupResult, setYptCleanupResult] = useState('');

  const runYptNamesCleanup = async () => {
    if (!window.confirm("Are you sure you want to remove all saved YPT usernames from all user profiles in the database?")) return;
    setYptCleanupLoading(true);
    setYptCleanupResult('Starting cleanup... fetching user profiles...');
    try {
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      let batch = writeBatch(db);
      let count = 0;
      let cleanedUsers = 0;

      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        const hasYptNames = data.yptNames !== undefined;
        const hasYptName = data.yptName !== undefined;
        const hasDefaultYpt = data.defaultYptHandle !== undefined;

        if (hasYptNames || hasYptName || hasDefaultYpt) {
          const updateData: any = {};
          if (hasYptNames) updateData.yptNames = deleteField();
          if (hasYptName) updateData.yptName = deleteField();
          if (hasDefaultYpt) updateData.defaultYptHandle = deleteField();

          batch.update(userDoc.ref, updateData);
          cleanedUsers++;
          count++;

          if (count === 490) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      setYptCleanupResult(`Cleanup complete! Removed stored YPT usernames from ${cleanedUsers} user profile(s).`);
    } catch (error: any) {
      console.error(error);
      setYptCleanupResult(`Error: ${error.message}`);
    } finally {
      setYptCleanupLoading(false);
    }
  };

  const runMigration = async () => {
    if (!window.confirm("Are you sure you want to run the dynamic subjects migration? This will affect all mock tests across all users. Make sure to back up data if necessary.")) return;
    setLoading(true);
    setResult('Starting migration... fetching mocks...');
    try {
      const mocksSnap = await getDocs(collectionGroup(db, 'mocks'));
      let batchCount = 0;
      let batch = writeBatch(db);
      let totalMigrated = 0;
      
      for (const mockDoc of mocksSnap.docs) {
        const m = mockDoc.data() as any;
        let changed = false;
        const newDynamic = { ...(m.dynamicSubjects || {}) };
        const categoryId = m.categoryId || 'banking';
        
        const migrate = (oldKey: string, newId: string) => {
          if (m[oldKey]) {
            if (!newDynamic[newId]) {
              newDynamic[newId] = m[oldKey];
            }
            changed = true;
          }
        };

        if (categoryId === 'banking') {
          migrate('quant', 'bank_quant');
          migrate('reasoning', 'bank_reasoning');
          migrate('english', 'bank_english');
          migrate('ga', 'bank_ga');
        } else if (categoryId === 'ssc') {
          migrate('quant', 'ssc_maths');
          migrate('reasoning', 'ssc_reasoning');
          migrate('english', 'ssc_english');
          migrate('ga', 'ssc_gk');
        }

        if (changed) {
          const updateData: any = { dynamicSubjects: newDynamic };
          if (m.quant !== undefined) updateData.quant = deleteField();
          if (m.reasoning !== undefined) updateData.reasoning = deleteField();
          if (m.english !== undefined) updateData.english = deleteField();
          if (m.ga !== undefined) updateData.ga = deleteField();
          
          batch.update(mockDoc.ref, updateData);
          batchCount++;
          totalMigrated++;
          
          if (batchCount === 490) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      setResult(`Migration completed successfully! Migrated ${totalMigrated} mocks out of ${mocksSnap.size} total mocks.`);
    } catch (error: any) {
      console.error(error);
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runActivityMigration = async () => {
    if (!window.confirm("Are you sure you want to run the last activity migration? This will set lastActiveAt for all users based on their latest mocks/creation time.")) return;
    setActivityLoading(true);
    setActivityResult('Starting migration... fetching users...');
    try {
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      
      let batch = writeBatch(db);
      let count = 0;
      let updatedUsers = 0;

      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        
        if (!userData.lastActiveAt) {
          let latestTime = 0;
          try {
            const mocksRef = collection(db, `users/${userDoc.id}/mocks`);
            const mocksSnap = await getDocs(query(mocksRef, orderBy('date', 'desc'), limit(1)));
            if (!mocksSnap.empty) {
                const latestMock: any = mocksSnap.docs[0].data();
                if (latestMock.date) {
                    if (typeof latestMock.date === 'string') {
                        latestTime = new Date(latestMock.date).getTime();
                    } else if (latestMock.date.toMillis) {
                        latestTime = latestMock.date.toMillis();
                    } else if (typeof latestMock.date === 'number') {
                        latestTime = latestMock.date;
                    } else if (latestMock.date.seconds) {
                        latestTime = latestMock.date.seconds * 1000;
                    }
                }
            }
          } catch (e) {
              // ignore
          }
          
          if (!latestTime && userData.createdAt) {
              if (typeof userData.createdAt === 'number') latestTime = userData.createdAt;
              else if (userData.createdAt.toMillis) latestTime = userData.createdAt.toMillis();
              else if (userData.createdAt.seconds) latestTime = userData.createdAt.seconds * 1000;
              else latestTime = new Date(userData.createdAt).getTime();
          }
          
          if (!latestTime) {
              latestTime = oneWeekAgo;
          }
          
          if (latestTime) {
            batch.update(userDoc.ref, { lastActiveAt: latestTime });
            updatedUsers++;
            count++;
            
            if (count === 490) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
          }
        }
      }
      
      if (count > 0) {
          await batch.commit();
      }
      
      setActivityResult(`Migration complete! Setup lastActiveAt for ${updatedUsers} users.`);
    } catch (error: any) {
      console.error(error);
      setActivityResult(`Error: ${error.message}`);
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/50 px-5 py-4">
              <h3 className="text-[15px] font-semibold text-indigo-700 dark:text-indigo-400">User Activity Migration</h3>
          </div>
          <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  This tool sets the <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">lastActiveAt</code> field for all existing users who don't have it, based on their latest mock date or account creation date.
              </p>
              
              <button 
                  onClick={runActivityMigration} 
                  disabled={activityLoading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                  {activityLoading && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                  )}
                  {activityLoading ? "Running Migration..." : "Update Past Users Logs"}
              </button>

              {activityResult && (
                  <div className={`mt-5 p-4 rounded-lg text-sm border ${activityResult.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400'}`}>
                      {activityResult}
                  </div>
              )}
          </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/50 px-5 py-4">
              <h3 className="text-[15px] font-semibold text-amber-700 dark:text-amber-400">YPT Profile Usernames Cleanup</h3>
          </div>
          <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Since manual YPT usernames are no longer needed on profiles, this utility cleans up legacy <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600 dark:text-amber-400">yptNames</code> and <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600 dark:text-amber-400">defaultYptHandle</code> fields across all user profile documents.
              </p>
              
              <button 
                  onClick={runYptNamesCleanup} 
                  disabled={yptCleanupLoading}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                  {yptCleanupLoading && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                  )}
                  {yptCleanupLoading ? "Cleaning Up..." : "Remove Stored YPT Usernames From Profiles"}
              </button>

              {yptCleanupResult && (
                  <div className={`mt-5 p-4 rounded-lg text-sm border ${yptCleanupResult.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400'}`}>
                      {yptCleanupResult}
                  </div>
              )}
          </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-6">
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/50 px-5 py-4">
              <h3 className="text-[15px] font-semibold text-red-700 dark:text-red-400">Danger Zone: Legacy Data Migration</h3>
          </div>
          <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  This tool performs a one-time migration of old mock data structures (using root keys like quant, reasoning, english, ga) to the new <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">dynamicSubjects</code> format. It scans all mocks across all users via <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">collectionGroup</code> and uses bulk <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">writeBatch</code> commits to safely map the keys based on each mock's <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">categoryId</code>.
                  <br /><br />
                  <strong>Note:</strong> This replaces the unsafe client-side automatic migrations that previously ran every time users loaded their data. Do not run this multiple times unnecessarily.
              </p>
              
              <button 
                  onClick={runMigration} 
                  disabled={loading}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg shadow disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                  {loading && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                  )}
                  {loading ? "Running Migration..." : "Run Database Migration"}
              </button>

              {result && (
                  <div className={`mt-5 p-4 rounded-lg text-sm border ${result.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400'}`}>
                      {result}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
