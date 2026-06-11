const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

async function testREST() {
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/cloudinary_webhook_logs`;

  console.log("POSTing to", url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        timestamp: { timestampValue: new Date().toISOString() },
        status: { stringValue: 'debugging from REST' },
        rawPayload: { stringValue: 'hello REST' }
      }
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}
testREST().catch(console.error);
