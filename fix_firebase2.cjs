const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const firestore = db;

  const docsToFix = ['bank_config', 'bank_settings', 'bank_leaderboardSettings'];
  
  for (const newId of docsToFix) {
    try {
       const sysSnap = await getDocs(collection(firestore, 'system'));
       const docSnap = sysSnap.docs.find(d => d.id === newId);
       if (docSnap) {
         console.log('Reverting', newId);
         const data = docSnap.data();
         delete data.categoryId; // remove categoryId
         const oldId = newId.replace('bank_', '');
         await setDoc(doc(firestore, 'system', oldId), data);
         await deleteDoc(doc(firestore, 'system', docSnap.id));
       }
    } catch (e) { console.error(e) }
  }

  // Also need to fix usr_chal_ stuff: the user said "change their ids to bank_something" so `bank_usr_chal_...`
  // Actually, wait, `usr_chal_` got changed to `bank_usr_chal_`.
  
  console.log('Done!');
}
run().catch(console.error);
