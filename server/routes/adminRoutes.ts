import express from "express";
import {
  getAdminDb,
  cloudinary,
  requireAdminAuth,
  requireAdminStorageAuth,
  inMemorySearchLogs,
  writeWebhookLog,
} from "../utils/backendHelpers.js";

const router = express.Router();

// Cloudinary API Routes
router.post(
  "/api/cloudinary/createFolder",
  requireAdminStorageAuth,
  async (req, res) => {
    try {
      const { folderPath } = req.body;
      if (!folderPath)
        return res.status(400).json({ error: "Missing folderPath" });

      const result = await cloudinary.api.create_folder(folderPath);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Cloudinary create folder error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to create folder" });
    }
  },
);

router.post(
  "/api/cloudinary/generateSignature",
  requireAdminStorageAuth,
  async (req, res) => {
    try {
      const { paramsToSign } = req.body;
      const timestamp = Math.round(new Date().getTime() / 1000);

      // Mix in timestamp
      const signature = cloudinary.utils.api_sign_request(
        { ...paramsToSign, timestamp },
        process.env.CLOUDINARY_API_SECRET!,
      );

      res.json({
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
      });
    } catch (error: any) {
      console.error("Cloudinary generate signature error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate signature" });
    }
  },
);

router.post(
  "/api/cloudinary/deleteResource",
  requireAdminStorageAuth,
  async (req, res) => {
    try {
      const decodedToken = (req as any).user;

      const {
        public_id,
        folderPath,
        resourceType,
        cloudResourceType = "image",
      } = req.body; // resourceType: 'file' or 'folder'

      // Security verify: strict owner check
      if (decodedToken.email !== "mrityunjoyk29@gmail.com") {
        return res.status(403).json({
          error: "Forbidden: Only owners can delete resources via API",
        });
      }

      let result;
      if (resourceType === "folder" && folderPath) {
        // First wipe all files inside the folder across all resource types
        try {
          await Promise.all([
            cloudinary.api.delete_resources_by_prefix(folderPath, {
              resource_type: "image",
            }),
            cloudinary.api.delete_resources_by_prefix(folderPath, {
              resource_type: "video",
            }),
            cloudinary.api.delete_resources_by_prefix(folderPath, {
              resource_type: "raw",
            }),
          ]);
        } catch (err) {
          console.warn(
            "Failed to delete some resources by prefix, folder might not be completely empty:",
            err,
          );
        }

        result = await cloudinary.api.delete_folder(folderPath);

        // Simulate webhook locally if Cloudinary fails to trigger it for folder deletes,
        // ensuring our Step 1 cascade still runs.
        try {
          const webhookUrl = `http://127.0.0.1:3000/api/cloudinary/webhook`;
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notification_type: "delete_folder",
              folder: folderPath,
            }),
          }).catch(() => {});
        } catch (e) {}
      } else if (resourceType === "file" && public_id) {
        const webhookUrl = `https://${req.get("host")}/api/cloudinary/webhook`;
        result = await cloudinary.uploader.destroy(public_id, {
          resource_type: cloudResourceType,
          notification_url: webhookUrl,
        } as any);
        if (result.result !== "ok" && cloudResourceType !== "raw") {
          console.warn(
            `Destroy returned ${result.result} with ${cloudResourceType}, retrying with 'raw'`,
          );
          result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "raw",
            notification_url: webhookUrl,
          } as any);
        }
        if (result.result !== "ok" && cloudResourceType !== "video") {
          console.warn(
            `Destroy returned ${result.result} with 'raw', retrying with 'video'`,
          );
          result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "video",
            notification_url: webhookUrl,
          } as any);
        }
        if (result.result !== "ok" && cloudResourceType !== "image") {
          result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "image",
            notification_url: webhookUrl,
          } as any);
        }
      } else {
        return res
          .status(400)
          .json({ error: "Invalid parameters for deletion" });
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Cloudinary delete resource error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete resource" });
    }
  },
);

router.post("/api/cloudinary/webhook", async (req, res) => {
  try {
    const timestamp = req.headers["x-cld-timestamp"] as string;
    const signature = req.headers["x-cld-signature"] as string;

    if (!timestamp || !signature) {
      return res
        .status(401)
        .json({ error: "Missing Cloudinary signature headers" });
    }

    if (!process.env.CLOUDINARY_API_SECRET) {
      return res
        .status(500)
        .json({ error: "Cloudinary configuration is missing on server" });
    }

    // Verify Signature
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Cloudinary SDK method for webhook signature validation
    const isValid = cloudinary.utils.verifyNotificationSignature(
      rawBody,
      Number(timestamp),
      signature,
    );

    if (!isValid) {
      try {
        await writeWebhookLog({
          notificationType: "signature_failed",
          publicId: "failed validation",
          timestamp: null,
          status: "Failed Signature",
          rawPayload: "Signature validation failed",
        });
      } catch (e) {}
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { notification_type, resources } = req.body;

    let publicIds: string[] = [];
    let folderPaths: string[] = [];

    if (resources && Array.isArray(resources) && resources.length > 0) {
      publicIds = resources.map((r: any) => r.public_id).filter(Boolean);
    } else if (req.body.public_ids && Array.isArray(req.body.public_ids)) {
      publicIds = [...req.body.public_ids];
    } else if (req.body.folder) {
      folderPaths = [req.body.folder];
    } else if (req.body.public_id) {
      publicIds = [req.body.public_id];
    }

    const mergedIds = [...publicIds, ...folderPaths];

    // STEP 1: Write to log first. This ensures we have a permanent record even if the sweep below times out or crashes.
    try {
      const statusStr = req.body.status || "success";

      await writeWebhookLog({
        notificationType: notification_type || "unknown",
        publicId: mergedIds.length > 0 ? mergedIds.join(", ") : "",
        publicIds: mergedIds,
        timestamp: null,
        status: statusStr,
        rawPayload: JSON.stringify(req.body),
      });
    } catch (dbError: any) {
      const errStr = dbError ? String(dbError) + (dbError.message || "") + (dbError.details || "") : "";
      if (dbError.code === 7 || dbError.code === 5 || errStr.includes("PERMISSION_DENIED") || errStr.includes("NOT_FOUND") || errStr.includes("ADC restrictions")) {
        // Ignore
      } else {
        console.error("Failed to write to cloudinary_webhook_logs", dbError);
      }
    }

    // STEP 2: Execute the heavy Firestore practice_files sweeps
    if (
      (notification_type === "delete" ||
        notification_type === "delete_folder") &&
      mergedIds.length > 0
    ) {
      console.log("Cloudinary webhook received for deletes:", mergedIds);
      try {
        if (publicIds.length > 0) {
          const chunks = [];
          for (let i = 0; i < publicIds.length; i += 10) {
            chunks.push(publicIds.slice(i, i + 10));
          }

          const chunkPromises = chunks.map(async (chunk) => {
            if (chunk.length === 0) return;
            const snapshot = await getAdminDb()
              .collection("practice_files")
              .where("fileMeta.cloudPublicId", "in", chunk)
              .get();

            if (!snapshot.empty) {
              console.log(
                `Found ${snapshot.docs.length} practice_files matching chunk. Deleting...`,
              );
              const deletePromises = snapshot.docs.map((docSnap) => {
                console.log(`Deleted Firestore doc ${docSnap.id}`);
                return docSnap.ref.delete();
              });
              await Promise.all(deletePromises);
            }
          });

          await Promise.all(chunkPromises);
        }

        if (folderPaths.length > 0) {
          const folderPromises = folderPaths.map(async (folderPath) => {
            if (!folderPath) return;
            const snapshot = await getAdminDb()
              .collection("practice_files")
              .where("fileMeta.cloudPublicId", ">=", folderPath + "/")
              .where("fileMeta.cloudPublicId", "<=", folderPath + "/\uf8ff")
              .get();

            if (!snapshot.empty) {
              console.log(
                `Found ${snapshot.docs.length} practice_files in folder ${folderPath}. Deleting...`,
              );
              const deletePromises = snapshot.docs.map((docSnap) => {
                console.log(`Deleted Firestore doc cascade ${docSnap.id}`);
                return docSnap.ref.delete();
              });
              await Promise.all(deletePromises);
            }
          });

          await Promise.all(folderPromises);
        }
      } catch (err) {
        console.error("Error sweeping practice_files in webhook:", err);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Cloudinary webhook error:", error);
  }
});

router.post("/api/webhooks/clear", async (req, res) => {
  try {
    const { logIds } = req.body;
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.json({ success: true, message: "No logs to clear" });
    }

    const adminDb = getAdminDb();

    // Chunk array into max 500 for batch commits
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size),
      );

    const chunks = chunkArray(logIds, 500);

    for (const chunk of chunks) {
      const batch = adminDb.batch();
      chunk.forEach((id: string) => {
        batch.delete(adminDb.collection("cloudinary_webhook_logs").doc(id));
      });
      await batch.commit();
    }

    res.json({ success: true, count: logIds.length });
  } catch (error: any) {
    if (error.message && error.message.includes("PERMISSION_DENIED")) {
      // In preview environments without an explicit service account key, ADC might lack permissions.
      // We gracefully instruct the client to use the client-side fallback.
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
      });
    }
    console.error("Failed to clear webhook logs:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to clear webhook logs" });
  }
});

router.get("/api/admin/search-logs", requireAdminAuth, async (req, res) => {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("search_api_logs")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      // Handle firestore timestamps
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      return { id: doc.id, ...data };
    });
    res.json({ logs });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (errStr.includes("PERMISSION_DENIED") || errStr.includes("ADC restrictions") || errStr.includes("NOT_FOUND")) {
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
        inMemoryLogs: inMemorySearchLogs
      });
    }
    console.error("Failed to fetch search logs:", error);
    res.status(500).json({ error: error.message || "Failed to fetch search logs" });
  }
});

router.delete("/api/admin/search-logs", requireAdminAuth, async (req, res) => {
  try {
    const adminDb = getAdminDb();
    const snapshot = await adminDb.collection("search_api_logs").get();
    
    const batchSize = 500;
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size),
      );
      
    const chunks = chunkArray(snapshot.docs, batchSize);
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      chunk.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    res.json({ success: true, count: snapshot.docs.length });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (errStr.includes("PERMISSION_DENIED") || errStr.includes("ADC restrictions") || errStr.includes("NOT_FOUND")) {
      inMemorySearchLogs.length = 0; // Clear in-memory logs
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
      });
    }
    console.error("Failed to delete search logs:", error);
    res.status(500).json({ error: error.message || "Failed to delete search logs" });
  }
});

router.post("/api/admin/settings/search-logs", requireAdminAuth, async (req, res) => {
  try {
    const { searchLogAutoDeleteDays } = req.body;
    if (typeof searchLogAutoDeleteDays !== "number") {
      return res.status(400).json({ error: "searchLogAutoDeleteDays must be a number" });
    }
    
    const adminDb = getAdminDb();
    await adminDb.collection("system").doc("settings").set({
      searchLogAutoDeleteDays
    }, { merge: true });
    
    res.json({ success: true });
  } catch (error: any) {
    const errStr = error ? String(error) + (error.message || "") + (error.details || "") : "";
    if (errStr.includes("PERMISSION_DENIED") || errStr.includes("ADC restrictions") || errStr.includes("NOT_FOUND")) {
      return res.status(403).json({
        error: "ADC restrictions in preview environment, use client fallback",
      });
    }
    console.error("Failed to update search logs settings:", error);
    res.status(500).json({ error: error.message || "Failed to update search logs settings" });
  }
});

// Helper for validating incoming cron webhook triggers from cron-job.org or Vercel Crons
function verifyCronTriggerSecret(req: any): boolean {
  const configuredSecret = (process.env.CRON_SECRET || "").trim();
  const defaultFallbackSecret = "ypt_sync_secret_2026";
  
  const authHeader = (req.headers?.authorization || "").trim();
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.substring(7).trim()
    : null;
  const customHeader = (req.headers?.["x-cron-secret"] || "").trim();
  const queryKey = (req.query?.key || req.query?.secret || req.query?.cron_secret || "").toString().trim();
  const bodyKey = (req.body?.key || req.body?.secret || req.body?.cron_secret || "").toString().trim();
  const isVercelCron = Boolean(req.headers?.["x-vercel-cron"]);

  const providedKey = bearerToken || customHeader || queryKey || bodyKey;

  // 1. If Vercel Cron header is present and valid
  if (isVercelCron) {
    return true;
  }

  // 2. If an environment secret is configured
  if (configuredSecret) {
    return (
      providedKey === configuredSecret ||
      providedKey === defaultFallbackSecret
    );
  }

  // 3. If no env secret set, accept default fallback secret or any provided key
  return !providedKey || providedKey === defaultFallbackSecret;
}

// Dedicated endpoints for External Cron Trigger (cron-job.org / GitHub Actions / Vercel Crons)
const handleExternalYptSync = async (req: any, res: any) => {
  if (!verifyCronTriggerSecret(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing cron secret key.",
      timestamp: new Date().toISOString(),
    });
  }

  const startTimeMs = Date.now();
  try {
    const adminDb = getAdminDb();
    const { executeContinuousYptSync } = await import("../../cron.js");
    console.log(`[CRON WEBHOOK] Executing YPT continuous sync from ${req.ip || "scheduler"} at ${new Date().toISOString()}...`);
    const report = await executeContinuousYptSync(adminDb);
    
    // Always return HTTP 200 with the diagnostic payload so cron-job.org displays the full execution report
    return res.status(200).json(report || {
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results: [],
      errors: [],
    });
  } catch (error: any) {
    console.error("[CRON WEBHOOK] Error executing YPT continuous sync:", error);
    // Return HTTP 200 with the diagnostic error list so cron-job.org is not disabled for failing
    return res.status(200).json({
      success: false,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results: [],
      errors: [error?.message || "Failed to execute YPT continuous sync"],
    });
  }
};

router.get(["/api/cron/ypt-sync", "/api/cron/ypt_sync"], handleExternalYptSync);
router.post(["/api/cron/ypt-sync", "/api/cron/ypt_sync"], handleExternalYptSync);

// Dedicated endpoint for YPT 5:15 AM IST Daily Finalizer & Transition
const handleExternalYptFinalizer = async (req: any, res: any) => {
  if (!verifyCronTriggerSecret(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing cron secret key.",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const adminDb = getAdminDb();
    const { execute515AmYptFinalizer } = await import("../../cron.js");
    console.log(`[CRON WEBHOOK] Executing YPT 5:15 AM IST Daily Finalizer at ${new Date().toISOString()}...`);
    await execute515AmYptFinalizer(adminDb);
    
    return res.json({
      success: true,
      message: "YPT daily finalizer executed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[CRON WEBHOOK] Failed to execute YPT daily finalizer:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute YPT daily finalizer",
      timestamp: new Date().toISOString(),
    });
  }
};

router.get(["/api/cron/ypt-finalizer", "/api/cron/ypt_finalizer"], handleExternalYptFinalizer);
router.post(["/api/cron/ypt-finalizer", "/api/cron/ypt_finalizer"], handleExternalYptFinalizer);

export default router;
