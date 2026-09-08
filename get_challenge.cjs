const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('yptChallenges').get();
  snapshot.forEach(doc => {
    console.log("Challenge ID:", doc.id);
    const data = doc.data();
    console.log("Rules:", JSON.stringify(data.rules?.customRules || [], null, 2));
  });
  process.exit(0);
}
run();
