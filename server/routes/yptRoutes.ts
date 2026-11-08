import express from "express";
import crypto from "crypto";
import admin from "firebase-admin";

const router = express.Router();

// YPT API Session Token Cache
let yptTokenCache: {
  token: string;
  coid: string;
  expiresAt: number;
} | null = null;

async function getYptAuthToken(req?: any) {
  const reqEmail = req?.headers?.["x-ypt-email"] || req?.query?.yptEmail || req?.body?.yptEmail;
  const reqPassword = req?.headers?.["x-ypt-password"] || req?.query?.yptPassword || req?.body?.yptPassword;
  const rawDirectToken = req?.headers?.["x-ypt-token"] || req?.query?.yptToken || req?.body?.yptToken || process.env.YPT_TOKEN;

  const directToken = rawDirectToken ? String(rawDirectToken).trim() : "";
  if (directToken && directToken !== "null" && directToken !== "undefined" && directToken.length > 10) {
    let coid = (req?.headers?.["x-ypt-coid"] as string) || "";
    if (!coid || coid === "0") {
      try {
        const infoRes = await fetch("https://pi.tgclab.com/user/v2/reload/info", {
          method: "POST",
          headers: {
            authorization: `JWT ${directToken}`,
            "User-Agent": "Dart/3.11 (dart:io)",
            "Content-Type": "application/json",
            "Accept-Encoding": "gzip",
          },
          body: JSON.stringify({
            pv: 0,
            cd: { su: null, sbu: null, cu: null, eu: null, du: null, tu: null },
          }),
        });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData && (infoData.coid || infoData.country_id)) {
            coid = String(infoData.coid || infoData.country_id);
          }
        }
      } catch (_e) {}
    }
    return {
      token: directToken,
      coid: coid || "8",
      expiresAt: Date.now() + 3600 * 1000,
    };
  }

  const email = (reqEmail || process.env.YPT_EMAIL || "").trim();
  const password = reqPassword || process.env.YPT_PASSWORD || "";

  if (!email || !password || email === "bot@example.com" || password === "YOUR_YPT_PASSWORD" || !email.includes("@")) {
    return null;
  }

  const now = Date.now();
  if (yptTokenCache && yptTokenCache.expiresAt > now + 5 * 60 * 1000 && !reqEmail) {
    return yptTokenCache;
  }

  // YPT auth accepts password or password hashes (MD5, SHA256)
  const md5Pass = crypto.createHash("md5").update(password).digest("hex");
  const sha256Pass = crypto.createHash("sha256").update(password).digest("hex");
  const passwordVariants = [password, md5Pass, sha256Pass];

  for (const passVar of passwordVariants) {
    try {
      const loginRes = await fetch("https://pi.tgclab.com/user/sign-in-jwt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Dart/3.11 (dart:io)",
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
        },
        body: JSON.stringify({
          email,
          password: passVar,
          loginProvider: "Email",
          new: true,
          getx: true,
          language: "en",
        }),
      });

      if (!loginRes.ok) continue;

      const data = await loginRes.json();
      if (!data || data.s === false) continue;

      const token = data.jwt || data.access_token || data.token;
      let coid = data.coid || data.country_id;

      if (token) {
        if (!coid || coid === "0" || coid === 0) {
          try {
            const infoRes = await fetch("https://pi.tgclab.com/user/v2/reload/info", {
              method: "POST",
              headers: {
                authorization: `JWT ${token}`,
                "User-Agent": "Dart/3.11 (dart:io)",
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip",
              },
              body: JSON.stringify({
                pv: 0,
                cd: { su: null, sbu: null, cu: null, eu: null, du: null, tu: null },
              }),
            });
            if (infoRes.ok) {
              const infoData = await infoRes.json();
              if (infoData && (infoData.coid || infoData.country_id)) {
                coid = infoData.coid || infoData.country_id;
              }
            }
          } catch (_e) {}
        }

        const result = {
          token,
          coid: String(coid || "8"),
          expiresAt: now + 50 * 60 * 1000,
        };

        if (!reqEmail) {
          yptTokenCache = result;
        }

        return result;
      }
    } catch (_err) {
      // Continue trying next password variant
    }
  }

  return null;
}

const DEMO_YPT_GROUPS = [
  { id: 331805, t: "🍇 SBI PO & UPSC Sprint 2026", mc: 8, on: "Aarav Sharma" },
  { id: 331806, t: "⚡ Tech & Code Study Guild", mc: 6, on: "Priya Patel" },
];

const DEMO_YPT_ROSTER = [
  { ud: 1001, n: "Aarav_SBI", dl: { sm: 23400000 } }, // 6.5 hrs
  { ud: 1002, n: "Priya_Code", dl: { sm: 38700000 } }, // 10.75 hrs
  { ud: 1003, n: "Rohan_UPSC", dl: { sm: 19800000 } }, // 5.5 hrs
  { ud: 1004, n: "Ananya_R", dl: { sm: 7200000 } },   // 2.0 hrs (under threshold)
  { ud: 1005, n: "Vikram_K", dl: { sm: 32400000 } },  // 9.0 hrs
  { ud: 1006, n: "Neha_Dev", dl: { sm: 14400000 } },  // 4.0 hrs
  { ud: 1007, n: "Karan_S", dl: { sm: 28800000 } },   // 8.0 hrs
  { ud: 1008, n: "Sneha_M", dl: { sm: 41400000 } },   // 11.5 hrs
];

// Server Proxy Endpoint for YPT Live Synchronization (/api/ypt/live-sync)
router.all("/api/ypt/live-sync", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ") && authHeader !== "Bearer undefined" && authHeader !== "Bearer null" && authHeader.length > 15) {
      const token = authHeader.split("Bearer ")[1];
      try {
        await admin.auth().verifyIdToken(token);
      } catch (_authErr: any) {
        // Continue silently if Firebase verification fails (e.g. guest or local dev mode)
      }
    }

    const action = (req.query.action || req.body?.action || "get-groups") as string;
    const groupIdsParam = req.query.groupIds || req.body?.groupIds;

    let yptJwt = "";
    let coid = "IN";
    let isDemoMode = false;

    const hasExplicitCreds = Boolean(
      req.headers["x-ypt-email"] || req.headers["x-ypt-password"] || req.headers["x-ypt-token"] ||
      req.query?.yptEmail || req.body?.yptEmail || req.query?.yptToken || req.body?.yptToken
    );

    const authData = await getYptAuthToken(req);
    if (authData) {
      yptJwt = authData.token;
      coid = authData.coid;
    } else if (hasExplicitCreds) {
      return res.status(400).json({
        success: false,
        error: "YPT Auth Failed (Code 112): Invalid email/password or account uses Google/Apple sign-in on YPT app. Paste your YPT JWT Access Token or add your YPT Group ID manually below.",
        isDemo: false,
      });
    } else {
      isDemoMode = true;
    }

    if (isDemoMode) {
      if (action === "get-groups") {
        return res.json({
          success: true,
          groups: DEMO_YPT_GROUPS,
          isDemo: true,
          message: "Loaded demo YPT groups (YPT credentials unconfigured or server unavailable)",
        });
      }

      if (action === "get-day-log" || action === "get-day-logs") {
        const dateParam = (req.query.date || req.body?.date || "") as string;
        const datesParam = (req.query.dates || req.body?.dates) as string | string[];
        const dateList = datesParam
          ? (Array.isArray(datesParam) ? datesParam : String(datesParam).split(","))
          : (dateParam ? [dateParam] : []);

        const demoHours = 6.25;
        const demoMs = demoHours * 3600000;
        const results = dateList.map((d) => ({
          date: d.trim(),
          totalMs: demoMs,
          studyHours: demoHours,
          subjects: [
            { id: 1, name: "Quantitative Aptitude", sm: 9000000, color: "#3B82F6" },
            { id: 2, name: "Reasoning", sm: 7200000, color: "#10B981" },
            { id: 3, name: "English", sm: 6300000, color: "#8B5CF6" },
          ],
        }));

        if (action === "get-day-logs" || dateList.length > 1) {
          return res.json({ success: true, dayLogs: results, isDemo: true });
        }

        return res.json({
          success: true,
          date: dateParam || results[0]?.date || "today",
          totalMs: demoMs,
          studyHours: demoHours,
          subjects: results[0]?.subjects || [],
          isDemo: true,
          message: "Loaded demo YPT day log (YPT credentials unconfigured or server unavailable)",
        });
      }

      if (action === "get-roster" || action === "get-live-times") {
        return res.json({
          success: true,
          roster: DEMO_YPT_ROSTER,
          members: DEMO_YPT_ROSTER,
          groups: DEMO_YPT_GROUPS,
          nativeChallenges: [
            { id: 331805, title: "🍇 test 3 (ID 331805)" }
          ],
          isDemo: true,
          message: "Loaded demo YPT roster (YPT credentials unconfigured or server unavailable)",
        });
      }
    }

    const yptHeaders = {
      authorization: `JWT ${yptJwt}`,
      "User-Agent": "Dart/3.11 (dart:io)",
      "Content-Type": "application/json",
      coid: coid,
    };

    if (action === "get-groups") {
      const gRes = await fetch("https://pi.tgclab.com/group/groups/v2", {
        headers: yptHeaders,
      });

      if (!gRes.ok) {
        const rawText = await gRes.text();
        const cleanText = rawText.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 150);
        return res.status(gRes.status).json({ error: `YPT Groups API Error (${gRes.status}): ${cleanText || "Server Error"}` });
      }

      const gData = await gRes.json();
      const rawGroups: any[] = [];
      if (Array.isArray(gData.gs)) rawGroups.push(...gData.gs);
      if (Array.isArray(gData.ms)) rawGroups.push(...gData.ms);
      if (Array.isArray(gData.cs)) rawGroups.push(...gData.cs);
      if (Array.isArray(gData.ps)) rawGroups.push(...gData.ps);
      if (rawGroups.length === 0 && Array.isArray(gData)) rawGroups.push(...gData);

      const map = new Map();
      for (const g of rawGroups) {
        if (g && g.id && !map.has(g.id)) map.set(g.id, g);
      }

      const groups = Array.from(map.values()).map((g: any) => ({
        id: g.id || g.gid,
        t: g.t || g.title || g.name || `Group ${g.id}`,
        jc: g.jc !== undefined ? Number(g.jc) : (g.mc ? Number(g.mc) : 0),
        mc: g.mc !== undefined ? Number(g.mc) : (g.jc ? Number(g.jc) : 0),
        on: g.on || g.ownerNickname,
      }));

      return res.json({
        success: true,
        groups,
        raw: gData,
      });
    }

    if (action === "get-day-log" || action === "get-day-logs") {
      const dateParam = (req.query.date || req.body?.date || "") as string;
      const datesParam = (req.query.dates || req.body?.dates) as string | string[];
      const dateList = datesParam
        ? (Array.isArray(datesParam) ? datesParam : String(datesParam).split(",")).map((d) => String(d).trim()).filter(Boolean)
        : (dateParam ? [dateParam.trim()] : []);

      if (dateList.length === 0) {
        return res.status(400).json({ error: "Missing required parameter 'date' or 'dates' (YYYY-MM-DD)" });
      }

      const fetchSingleDay = async (d: string) => {
        try {
          const logUrl = `https://pi.tgclab.com/logs/day?date=${encodeURIComponent(d)}&countryID=${encodeURIComponent(coid)}`;
          const logRes = await fetch(logUrl, { headers: yptHeaders });
          if (!logRes.ok) {
            const rawText = await logRes.text();
            const cleanText = rawText.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 150);
            return {
              date: d,
              totalMs: 0,
              studyHours: 0,
              subjects: [],
              error: `YPT API Error (${logRes.status}): ${cleanText}`,
            };
          }

          const logData = await logRes.json();
          let totalMs = 0;
          if (typeof logData.sm === "number") totalMs = logData.sm;
          else if (typeof logData.total_sm === "number") totalMs = logData.total_sm;
          else if (typeof logData.totalTime === "number") totalMs = logData.totalTime > 100000 ? logData.totalTime : logData.totalTime * 1000;

          const subjects: any[] = [];
          if (Array.isArray(logData.ss)) {
            let subjectSumMs = 0;
            for (const s of logData.ss) {
              if (s) {
                const sMs = typeof s.sm === "number" ? s.sm : (typeof s.st === "number" ? s.st * 1000 : 0);
                subjectSumMs += sMs;
                subjects.push({
                  id: s.id || s.sid,
                  name: s.n || s.name || s.t || s.title || "Subject",
                  sm: sMs,
                  hours: Math.round((sMs / 3600000) * 100) / 100,
                  color: s.c || s.color,
                });
              }
            }
            if (totalMs === 0 && subjectSumMs > 0) {
              totalMs = subjectSumMs;
            }
          }

          const studyHours = Math.round((totalMs / 3600000) * 100) / 100;
          return {
            date: d,
            totalMs,
            studyHours,
            subjects,
            raw: logData,
          };
        } catch (err: any) {
          return {
            date: d,
            totalMs: 0,
            studyHours: 0,
            subjects: [],
            error: String(err?.message || err),
          };
        }
      };

      const dayLogs = await Promise.all(dateList.map(fetchSingleDay));

      if (action === "get-day-logs" || dateList.length > 1) {
        return res.json({
          success: true,
          dayLogs,
        });
      }

      const single = dayLogs[0];
      return res.json({
        success: true,
        date: single.date,
        totalMs: single.totalMs,
        studyHours: single.studyHours,
        subjects: single.subjects,
        raw: single.raw,
        error: single.error,
      });
    }

    if (action === "get-roster" || action === "get-live-times") {
      let gids: string[] = [];
      if (Array.isArray(groupIdsParam) && groupIdsParam.length > 0) {
        gids = groupIdsParam.map((id: any) => String(id).trim()).filter(Boolean);
      } else if (typeof groupIdsParam === "string" || typeof groupIdsParam === "number") {
        gids = String(groupIdsParam).split(",").map((s) => s.trim()).filter(Boolean);
      }

      if (gids.length === 0) {
        const gRes = await fetch("https://pi.tgclab.com/group/groups/v2", { headers: yptHeaders });
        if (gRes.ok) {
          const gData = await gRes.json();
          let rawGroups: any[] = [];
          if (Array.isArray(gData.gs)) rawGroups.push(...gData.gs);
          if (Array.isArray(gData.ms)) rawGroups.push(...gData.ms);
          if (Array.isArray(gData.cs)) rawGroups.push(...gData.cs);
          if (Array.isArray(gData.ps)) rawGroups.push(...gData.ps);
          gids = rawGroups.map((g: any) => String(g.id)).filter(Boolean);
        }
      }

      if (gids.length === 0) {
        return res.json({ success: true, roster: [], members: [], groups: [], nativeChallenges: [] });
      }

      const allMembers: any[] = [];
      const rawChallenges: any[] = [];

      await Promise.all(
        gids.map(async (gid) => {
          try {
            const mUrl = `https://pi.tgclab.com/logs/group/members/v2?groupID=${encodeURIComponent(gid)}&countryID=${encodeURIComponent(coid)}&isLooking=true&version=810046`;
            const mRes = await fetch(mUrl, { headers: yptHeaders });
            if (mRes.ok) {
              const mData = await mRes.json();
              if (Array.isArray(mData.ms)) {
                allMembers.push(...mData.ms);
                // Extract active challenge objects from all members' cls/cs dictionaries
                for (const m of mData.ms) {
                  if (m && m.cls) {
                    if (Array.isArray(m.cls)) {
                      rawChallenges.push(...m.cls);
                    } else if (typeof m.cls === 'object') {
                      for (const [challengeIdStr, challengeItem] of Object.entries(m.cls)) {
                        const chId = Number(challengeIdStr);
                        if (chId && !isNaN(chId)) {
                          rawChallenges.push({
                            ...(typeof challengeItem === 'object' && challengeItem ? (challengeItem as object) : {}),
                            id: chId,
                          });
                        }
                      }
                    }
                  }
                  if (m && m.cs) {
                    if (Array.isArray(m.cs)) {
                      rawChallenges.push(...m.cs);
                    } else if (typeof m.cs === 'object') {
                      for (const [csIdStr, csItem] of Object.entries(m.cs)) {
                        const csId = Number(csIdStr);
                        if (csId && !isNaN(csId)) {
                          rawChallenges.push({
                            ...(typeof csItem === 'object' && csItem ? (csItem as object) : {}),
                            id: csId,
                          });
                        } else {
                          rawChallenges.push(csItem);
                        }
                      }
                    }
                  }
                }
              }

              // Top level challenge properties in response
              if (Array.isArray(mData.cs)) rawChallenges.push(...mData.cs);
              if (Array.isArray(mData.cls)) rawChallenges.push(...mData.cls);
              if (Array.isArray(mData.chs)) rawChallenges.push(...mData.chs);
              if (Array.isArray(mData.challenges)) rawChallenges.push(...mData.challenges);
              if (mData.group && Array.isArray(mData.group.challenges)) rawChallenges.push(...mData.group.challenges);
              if (mData.group && Array.isArray(mData.group.cs)) rawChallenges.push(...mData.group.cs);
              if (mData.g && Array.isArray(mData.g.cs)) rawChallenges.push(...mData.g.cs);
              if (mData.g && Array.isArray(mData.g.cls)) rawChallenges.push(...mData.g.cls);
            }
          } catch (err) {
            console.warn(`Failed to fetch members for group ${gid}:`, err);
          }

          // Also attempt group challenges endpoint
          try {
            const chUrl = `https://pi.tgclab.com/group/challenges/v2?groupID=${encodeURIComponent(gid)}&countryID=${encodeURIComponent(coid)}&version=810046`;
            const chRes = await fetch(chUrl, { headers: yptHeaders });
            if (chRes.ok) {
              const chData = await chRes.json();
              if (Array.isArray(chData.cs)) rawChallenges.push(...chData.cs);
              if (Array.isArray(chData.cls)) rawChallenges.push(...chData.cls);
              if (Array.isArray(chData.challenges)) rawChallenges.push(...chData.challenges);
              if (Array.isArray(chData.chs)) rawChallenges.push(...chData.chs);
              if (Array.isArray(chData)) rawChallenges.push(...chData);
            }
          } catch (e) {
            // Optional endpoint
          }
        })
      );

      // Deduplicate members by permanent User ID (ud) or Nickname (n)
      const memberMap = new Map();
      for (const m of allMembers) {
        const key = m.ud || m.n;
        if (key && !memberMap.has(key)) {
          memberMap.set(key, m);
        }
      }
      const members = Array.from(memberMap.values());

      // Deduplicate and normalize native challenges by ID
      const challengeMap = new Map<number, { id: number; t: string; title: string; e: string; emoji: string; st: number }>();
      for (const c of rawChallenges) {
        if (!c || typeof c !== 'object') continue;
        const id = Number(c.id || c.cid || c.challengeID || c.challengeId);
        if (!id || isNaN(id)) continue;

        const rawTitle = String(c.t || c.title || c.name || c.subject || c.text || '').trim();
        let title = rawTitle;
        let emoji = String(c.e || c.emoji || c.icon || '').trim();

        if (!emoji && title) {
          const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDDFF])/u;
          const match = title.match(emojiRegex);
          if (match) {
            emoji = match[0];
            title = title.replace(emojiRegex, '').trim();
          }
        }

        const existing = challengeMap.get(id);
        if (!existing) {
          challengeMap.set(id, {
            id,
            t: title || `Mission #${id}`,
            title: title || `Mission #${id}`,
            e: emoji || '📸',
            emoji: emoji || '📸',
            st: c.st !== undefined ? Number(c.st) : 0,
          });
        } else {
          // If existing entry has a fallback placeholder, upgrade it with real title/emoji metadata
          if (title && (existing.title.startsWith('Mission #') || !existing.title)) {
            existing.title = title;
            existing.t = title;
          }
          if (emoji && (existing.emoji === '📸' || !existing.emoji)) {
            existing.emoji = emoji;
            existing.e = emoji;
          }
          if (c.st !== undefined && existing.st === 0) {
            existing.st = Number(c.st);
          }
        }
      }
      const nativeChallenges = Array.from(challengeMap.values());

      return res.json({
        success: true,
        roster: members,
        members,
        nativeChallenges,
      });
    }

    return res.status(400).json({ error: `Unknown action '${action}'` });
  } catch (error: any) {
    console.error("YPT Proxy Error:", error);
    const cleanMsg = String(error.message || error).replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().substring(0, 150);
    res.status(500).json({ error: cleanMsg || "Internal Server Error" });
  }
});

export default router;
