const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function run() {
  const docsToFix = ['bank_config', 'bank_settings', 'bank_leaderboardSettings'];
  
  for (const newId of docsToFix) {
    try {
       const sysSnap = await getDocs(collection(db, 'system'));
       const docSnap = sysSnap.docs.find(d => d.id === newId);
       if (docSnap) {
         console.log('Reverting', newId);
         const data = docSnap.data();
         delete data.categoryId; // remove categoryId
         const oldId = newId.replace('bank_', '');
         await setDoc(doc(db, 'system', oldId), data);
         await deleteDoc(doc(db, 'system', docSnap.id));
       }
    } catch (e) { console.error(e) }
  }
  
  console.log('Done!');
  process.exit(0);
}
run().catch(console.error);
