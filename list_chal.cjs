const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function run() {
  const chalSnap = await getDocs(collection(db, 'challenges'));
  const ids = chalSnap.docs.map(d => d.id);
  console.log('Challenge docs:', ids);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
