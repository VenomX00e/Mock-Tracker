import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const categoriesRef = collection(db, 'categories');
  const snap = await getDocs(categoriesRef);
  snap.docs.forEach(d => {
    console.log(d.id, d.data().name);
    console.log(JSON.stringify(d.data().subjects, null, 2));
  });
}

check().then(() => console.log('done')).catch(console.error);
