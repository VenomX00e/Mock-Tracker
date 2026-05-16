import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

let configRaw;
try {
  configRaw = fs.readFileSync('./firebase-applet-config.json', 'utf8');
} catch (e) {
  configRaw = fs.readFileSync('./src/firebase-applet-config.json', 'utf8');
}
const config = JSON.parse(configRaw);
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  console.log("Fetching users...");
  const usersRef = collection(db, 'users');
  const usersSnap = await getDocs(usersRef);
  
  console.log(`Found ${usersSnap.size} users`);
  let batch = writeBatch(db);
  let count = 0;
  let updatedUsers = 0;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    
    // Only update if they don't have a recent lastActiveAt or they don't have it at all
    if (!userData.lastActiveAt) {
      let latestTime = 0;
      
      try {
        const mocksSnap = await getDocs(query(collection(db, `users/${userDoc.id}/mocks`), orderBy('date', 'desc'), limit(1)));
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
          console.warn("Could not read mocks for", userDoc.id);
      }
      
      if (!latestTime && userData.createdAt) {
          if (typeof userData.createdAt === 'number') latestTime = userData.createdAt;
          else if (userData.createdAt.toMillis) latestTime = userData.createdAt.toMillis();
          else if (userData.createdAt.seconds) latestTime = userData.createdAt.seconds * 1000;
          else latestTime = new Date(userData.createdAt).getTime();
      }
      
      if (!latestTime) {
          latestTime = Date.now() - 7 * 24 * 60 * 60 * 1000; 
      }
      
      if (latestTime) {
        batch.update(userDoc.ref, { lastActiveAt: latestTime });
        updatedUsers++;
        count++;
        
        if (count === 400) {
            await batch.commit();
            console.log(`Committed ${count} updates`);
            batch = writeBatch(db);
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
