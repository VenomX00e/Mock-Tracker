import cron from "node-cron";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let firebaseConfig: any = null;
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {
  console.error("Could not load firebase-applet-config.json", e);
}

if (firebaseConfig && !admin.apps.length) {
  try {
    let credential = admin.credential.applicationDefault();
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = admin.credential.cert(serviceAccount);
      } catch (e) {
        console.error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY format", e);
      }
    }
    
    admin.initializeApp({
      credential,
      projectId: firebaseConfig?.projectId // explicitly pass to ensure verifyIdToken works for the right project
    });
  } catch(e) {
    console.error("Failed to initialize firebase-admin:", e);
  }
}

const db = firebaseConfig && admin.apps.length ? getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId) : null;

// Helper to calculate stats safely
function calculateUserStats(mocks: any[]) {
    let sumP = 0, pCount = 0;
    
    mocks.forEach(m => {
        if ((!m.examScope || m.examScope === 'Full') && m.percentile != null && !isNaN(m.percentile) && m.percentile > 0) {
            sumP += m.percentile;
            pCount++;
        }
    });
    
    return {
        avgPercentile: pCount > 0 ? Number((sumP / pCount).toFixed(2)) : 0,
        totalTests: mocks.length,
    };
}

export function startCron() {
  if (!db) {
    console.warn("Cron not started: Admin DB is not initialized. Might be missing ADC credentials.");
    return;
  }
  
  console.log("Registered 2-hour leaderboard recalculation cron job.");

  // Runs every 2 hours
  cron.schedule("0 */2 * * *", async () => {
    console.log("Running 2-hour leaderboard recalculation task...");
    try {
      // 1. Fetch all users
      const usersSnap = await db.collection("users").get();
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 2. Fetch all mocks (using collectionGroup if possible, or individual queries)
      // Node SDK has collectionGroup
      const mocksSnap = await db.collectionGroup("mocks").get();
      const allMocks = mocksSnap.docs.map(d => {
           const data = d.data();
           return { id: d.id, userId: d.ref.parent.parent?.id, ...data };
      }).filter((m: any) => !m.isDeleted);

      // Group mocks by user
      const userMocks: Record<string, any[]> = {};
      allMocks.forEach(m => {
          if (m.userId) {
              if (!userMocks[m.userId]) Object.assign(userMocks, { [m.userId]: [] });
              userMocks[m.userId].push(m);
          }
      });

      const batch = db.batch();
      let updatesCount = 0;

      for (const user of users) {
          const mocks = userMocks[user.id] || [];
          if (mocks.length === 0) continue;

          // Note: Full calculateStats logic can be duplicated here,
          // but we just update minimal required fields like avgPercentile
          // since the frontend calculates dynamic ones or runs the full fallback if needed.
          // Wait, the user asked to "calculate leaderboard rank... and take necessary steps".
          // The frontend relies on totalTests, avgPercentile inside user document.
          const { avgPercentile, totalTests } = calculateUserStats(mocks);

          // We'll update the fields if they are mismatched. 
          // Avoiding unnecessary writes.
          if (user.avgPercentile !== avgPercentile || user.totalTests !== totalTests) {
              const ref = db.collection("users").doc(user.id);
              batch.update(ref, { 
                  avgPercentile, 
                  totalTests, 
                  // If we wanted to keep the rank, we could store it, 
                  // but leaderboard is dynamically sorted on frontend.
                  // By storing up-to-date avgPercentile, we ensure frontend sorting works.
              });
              updatesCount++;
          }
          
          if (updatesCount >= 400) {
              await batch.commit();
              updatesCount = 0;
          }
      }
      
      if (updatesCount > 0) {
          await batch.commit();
      }

      console.log(`Leaderboard recalculation finished. Updated ${updatesCount} users.`);
    } catch (error: any) {
      if (error && error.code === 7) {
        console.warn("\n[WARNING] Leaderboard Cron skipped due to PERMISSION_DENIED.");
        console.warn("When running in the development sandbox, the default service account lacks Firestore access to your external Firebase project.");
        console.warn("This cron will automatically work in the production deployed app.\n");
      } else {
        console.error("Leaderboard Cron failed:", error);
      }
    }
  });
}
