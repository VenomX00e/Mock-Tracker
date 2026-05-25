const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
// Use firestoreDatabaseId if provided!
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function run() {
  const sysSnap = await getDocs(collection(db, 'system'));
  const ids = sysSnap.docs.map(d => d.id);
  console.log('System docs:', ids);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
