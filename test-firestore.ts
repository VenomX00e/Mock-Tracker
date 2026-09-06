import { initFirebaseAdmin } from "./firebase-admin-init.js";
const { db } = initFirebaseAdmin();
db.collection("yptChallenges").doc("M1uyPnnP41ml0mBSXG2S").get().then(doc => {
  console.log(JSON.stringify(doc.data(), null, 2));
}).catch(console.error);
