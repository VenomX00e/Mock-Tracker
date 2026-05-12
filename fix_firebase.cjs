const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app); // Note: getFirestore(app, id) is not in regular sdk usually, or wait, some SDKs have it. We'll stick to web sdk usage. Actually we can use the source code since it has `getFirestore(app, config.firestoreDatabaseId)`.

async function run() {
  const dbConfig = config.firestoreDatabaseId ? [app, config.firestoreDatabaseId] : [app];
  const firestore = getFirestore(...dbConfig);

  const sysSnap = await getDocs(collection(firestore, 'system'));
  for (const docSnap of sysSnap.docs) {
    const data = docSnap.data();
    if (!data.categoryId) {
      console.log('Fixing system doc:', docSnap.id);
      let newId = docSnap.id;
      if (!newId.startsWith('bank_')) {
        newId = 'bank_' + newId;
      }
      data.categoryId = 'banking';
      if (newId !== docSnap.id) {
        await setDoc(doc(firestore, 'system', newId), data);
        await deleteDoc(doc(firestore, 'system', docSnap.id));
      } else {
        await setDoc(doc(firestore, 'system', docSnap.id), data);
      }
    }
  }

  const chalSnap = await getDocs(collection(firestore, 'challenges'));
  for (const docSnap of chalSnap.docs) {
    const data = docSnap.data();
    if (!data.categoryId) {
      console.log('Fixing challenge doc:', docSnap.id);
      let newId = docSnap.id;
      if (!newId.startsWith('bank_')) {
        newId = 'bank_' + newId;
      }
      data.categoryId = 'banking';
      if (newId !== docSnap.id) {
        await setDoc(doc(firestore, 'challenges', newId), data);
        await deleteDoc(doc(firestore, 'challenges', docSnap.id));
      } else {
        await setDoc(doc(firestore, 'challenges', docSnap.id), data);
      }
    }
  }
  
  console.log('Done!');
}
run().catch(console.error);
