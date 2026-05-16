import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin
try {
  const configRaw = fs.readFileSync('./firebase-applet-config.json', 'utf8');
  const firebaseConfig = JSON.parse(configRaw);
  if (firebaseConfig.projectId) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("Initialized with project:", firebaseConfig.projectId);
  }
} catch (e) {
  console.log("No config found, trying default init");
  admin.initializeApp();
}

const db = admin.firestore();

async function run() {
  console.log("Fetching users...");
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.get();
  
  console.log(`Found ${usersSnap.size} users`);
  
  let batch = db.batch();
  let count = 0;
  let updatedUsers = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    
    // Only update if they don't have a recent lastActiveAt or they don't have it at all
    if (!userData.lastActiveAt) {
      let latestTime = 0;
      
      // Try to find the latest mock date
      const mocksSnap = await db.collection(`users/${userDoc.id}/mocks`).orderBy('date', 'desc').limit(1).get();
      if (!mocksSnap.empty) {
        const latestMock = mocksSnap.docs[0].data();
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
      
      if (!latestTime && userData.createdAt) {
          if (typeof userData.createdAt === 'number') latestTime = userData.createdAt;
          else if (userData.createdAt.toMillis) latestTime = userData.createdAt.toMillis();
          else if (userData.createdAt.seconds) latestTime = userData.createdAt.seconds * 1000;
          else latestTime = new Date(userData.createdAt).getTime();
      }
      
      if (!latestTime) {
          // If no mocks and no createdAt exist, default to 1 week ago for older users
          latestTime = Date.now() - 7 * 24 * 60 * 60 * 1000; 
      }
      
      if (latestTime) {
        batch.update(userDoc.ref, { lastActiveAt: latestTime });
        updatedUsers++;
        count++;
        
        if (count === 400) {
            await batch.commit();
            console.log(`Committed ${count} updates`);
            batch = db.batch();
            count = 0;
        }
      }
    }
  }
  
  if (count > 0) {
      await batch.commit();
      console.log(`Committed final ${count} updates`);
  }
  
  console.log(`Migration complete. Updated ${updatedUsers} users.`);
}

run().catch(console.error);
