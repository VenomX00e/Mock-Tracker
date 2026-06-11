import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testWrite() {
  try {
    const res = await addDoc(collection(db, 'cloudinary_webhook_logs'), {
      time: serverTimestamp(),
      msg: 'hello client SDK'
    });
    console.log('Write success!', res.id);
  } catch(e) {
    console.error('Write failed:', e);
  }
}
testWrite();
