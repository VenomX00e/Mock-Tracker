const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

const target = `    // Lazy initialize admin if needed, or rely on cron.ts initializing it
    const admin = await import("firebase-admin");
    if (!admin.default.apps.length) {
      try {
         const fs = await import("fs");
         const path = await import("path");
         const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
         const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
         admin.default.initializeApp({ projectId: config.projectId });
      } catch (e) {
         console.warn("Could not lazily initialize firebase-admin", e);
      }
    }

    try {
      await admin.default.auth().verifyIdToken(token);
    } catch (authErr) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }`;

const target2 = `    const admin = await import("firebase-admin");
    if (!admin.default.apps.length) {
      try {
         const fs = await import("fs");
         const path = await import("path");
         const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
         const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
         admin.default.initializeApp({ projectId: config.projectId });
      } catch (e) {
         console.warn("Could not lazily initialize firebase-admin", e);
      }
    }

    try {
       await admin.default.auth().verifyIdToken(token);
    } catch (authErr) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }`;

const replace = `    // Lazy initialize admin if needed, or rely on cron.ts initializing it
    const admin = Object.keys(require.cache).some(k => k.includes('firebase-admin')) 
        ? require('firebase-admin') : await import("firebase-admin");
    if (!admin.apps || !admin.apps.length) {
      try {
         const configMod = Object.keys(require.cache).some(k => k.includes('firebase-applet-config.json'))
            ? require("./firebase-applet-config.json") : await import("./firebase-applet-config.json", { with: { type: "json" } }).catch(() => require("./firebase-applet-config.json"));
         const config = configMod.default || configMod;
         admin.initializeApp({ projectId: config.projectId });
      } catch (e) {
         console.warn("Could not lazily initialize firebase-admin", e);
      }
    }

    try {
      await admin.auth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error("Token verification failed:", authErr);
      return res.status(403).json({ error: "Forbidden: Invalid token. " + (authErr?.message || "") });
    }`;

code = code.split(target).join(replace);
code = code.split(target2).join(replace);

fs.writeFileSync('api-router.ts', code);
