import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let cachedAdminApp: admin.app.App | null = null;
let cachedFirestoreDb: admin.firestore.Firestore | null = null;

export function getFirebaseConfig() {
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e: any) {
    console.warn("[Firebase Admin] Could not read firebase-applet-config.json from cwd:", e?.message);
  }

  // Built-in project fallback
  return {
    projectId: "project-8cd430e4-1498-4f8c-b8f",
    firestoreDatabaseId: "ai-studio-510333c8-1e77-4656-9450-5519f8d32397",
  };
}

export function initFirebaseAdmin(): { app: admin.app.App; db: admin.firestore.Firestore } {
  if (cachedAdminApp && cachedFirestoreDb) {
    return { app: cachedAdminApp, db: cachedFirestoreDb };
  }

  const fbConfig = getFirebaseConfig();
  const projectId = fbConfig.projectId || "project-8cd430e4-1498-4f8c-b8f";
  const firestoreDatabaseId = fbConfig.firestoreDatabaseId || "ai-studio-510333c8-1e77-4656-9450-5519f8d32397";

  if (!admin.apps.length) {
    // Check all common environment variable names for service accounts
    const rawKey =
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_ADMIN_CREDENTIALS ||
      process.env.FIREBASE_KEY;

    let credential: admin.credential.Credential | null = null;

    if (rawKey) {
      try {
        let serviceAccount: any = null;
        if (typeof rawKey === "object") {
          serviceAccount = rawKey;
        } else if (typeof rawKey === "string") {
          const trimmed = rawKey.trim();
          if (trimmed.startsWith("{")) {
            serviceAccount = JSON.parse(trimmed);
          } else {
            // Try base64 decoding
            try {
              const decoded = Buffer.from(trimmed, "base64").toString("utf8");
              if (decoded.trim().startsWith("{")) {
                serviceAccount = JSON.parse(decoded);
              }
            } catch {}
          }
        }

        if (serviceAccount && serviceAccount.private_key) {
          // Fix escaped newlines in private key if present
          if (typeof serviceAccount.private_key === "string") {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
          }
          credential = admin.credential.cert(serviceAccount);
          console.log("[Firebase Admin] Successfully initialized with service account key for project:", serviceAccount.project_id || projectId);
        }
      } catch (keyErr: any) {
        console.error("[Firebase Admin] Error parsing service account key:", keyErr?.message || keyErr);
      }
    }

    try {
      cachedAdminApp = admin.initializeApp({
        credential: credential || admin.credential.applicationDefault(),
        projectId,
      });
    } catch (initErr: any) {
      if (admin.apps.length > 0) {
        cachedAdminApp = admin.app();
      } else {
        console.error("[Firebase Admin] Failed initializeApp:", initErr);
        cachedAdminApp = admin.initializeApp({ projectId });
      }
    }
  } else {
    cachedAdminApp = admin.app();
  }

  try {
    cachedFirestoreDb = firestoreDatabaseId
      ? getFirestore(cachedAdminApp, firestoreDatabaseId)
      : admin.firestore(cachedAdminApp);
  } catch (dbErr: any) {
    console.warn("[Firebase Admin] Custom databaseId connection error, falling back to default:", dbErr?.message);
    cachedFirestoreDb = admin.firestore(cachedAdminApp);
  }

  try {
    cachedFirestoreDb.settings({ ignoreUndefinedProperties: true });
  } catch (settingsErr: any) {
    // In case settings were already locked or applied
    console.debug("[Firebase Admin] Note on firestore settings:", settingsErr?.message);
  }

  return { app: cachedAdminApp, db: cachedFirestoreDb };
}

export function getAdminDb(): admin.firestore.Firestore {
  return initFirebaseAdmin().db;
}

export default initFirebaseAdmin;
