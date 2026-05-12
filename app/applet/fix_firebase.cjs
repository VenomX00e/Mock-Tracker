const fs = require('fs');

async function test() {
  const firebaseConfig = require('./src/firebase-applet-config.json');
  console.log("Found config", firebaseConfig.firebaseProjectId);
}

test();
