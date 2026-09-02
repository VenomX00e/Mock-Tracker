import { getAdminDb } from "../../firebase-admin-init.js";
import { executeContinuousYptSync } from "../../cron.js";

function verifySecret(req: any): boolean {
  const configuredSecret = (process.env.CRON_SECRET || process.env.CRON_SECRET_KEY || "").trim();
  const validSecrets = ["ypt_sync_secret_2026", "cron_trigger_secret_2026"];
  if (configuredSecret) validSecrets.push(configuredSecret);

  const authHeader = (req.headers?.authorization || "").trim();
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.substring(7).trim()
    : null;
  const customHeader = (req.headers?.["x-cron-secret"] || req.headers?.["x-cron-key"] || "").trim();
  const queryKey = (req.query?.key || req.query?.secret || req.query?.cron_secret || "").toString().trim();
  const bodyKey = (req.body?.key || req.body?.secret || req.body?.cron_secret || "").toString().trim();
  const isVercelCron = Boolean(req.headers?.["x-vercel-cron"]);

  if (isVercelCron) return true;

  const providedKey = bearerToken || customHeader || queryKey || bodyKey;
  if (!providedKey) return false;
  return validSecrets.includes(providedKey);
}

export default async function handler(req: any, res: any) {
  // Set CORS and JSON headers
  res.setHeader("Content-Type", "application/json");

  if (!verifySecret(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing cron secret key.",
      timestamp: new Date().toISOString(),
    });
  }

  const startTimeMs = Date.now();
  try {
    const adminDb = getAdminDb();
    console.log(`[VERCEL CRON] Executing YPT continuous sync at ${new Date().toISOString()}...`);
    const report = await executeContinuousYptSync(adminDb);
    return res.status(200).json(report || {
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results: [],
      errors: [],
    });
  } catch (error: any) {
    console.error("[VERCEL CRON] Error executing YPT continuous sync:", error);
    return res.status(200).json({
      success: false,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTimeMs,
      results: [],
      errors: [error?.message || "Failed to execute YPT continuous sync"],
    });
  }
}
