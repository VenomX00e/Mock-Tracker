import express from "express";
import { initFirebaseAdmin } from "./firebase-admin-init.js";
import yptRoutes from "./server/routes/yptRoutes.js";
import jarvisRoutes from "./server/routes/jarvisRoutes.js";
import extractionRoutes from "./server/routes/extractionRoutes.js";
import adminRoutes from "./server/routes/adminRoutes.js";

initFirebaseAdmin();

const app = express();

app.use((req, res, next) => {
  // If Vercel already parsed it into an object that is not a Buffer
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    (req as any)._body = true;
  }
  next();
});

app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);

// Mount modular route domains at root so all /api/* paths remain 100% identical
app.use(yptRoutes);
app.use(jarvisRoutes);
app.use(extractionRoutes);
app.use(adminRoutes);

export default app;
