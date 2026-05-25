const fs = require('fs');
let code = fs.readFileSync('api-router.ts', 'utf8');

const prefix = `import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json";

if (!admin.apps.length) {
   admin.initializeApp({ projectId: firebaseConfig.projectId });
}
`;

code = code.replace(`import express from "express";\nimport { GoogleGenAI, Type } from "@google/genai";`, prefix);

const target = `    // Lazy initialize admin if needed, or rely on cron.ts initializing it
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
    }`;

code = code.split(target).join("");
fs.writeFileSync('api-router.ts', code);
