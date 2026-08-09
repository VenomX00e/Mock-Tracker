import { YptExtractedMemberData, YptRuleConfig } from "../types/yptTypes";
import { auth } from "./firebase";
import { getActiveApiKey } from "../utils/apiKeyManager";
import { getRegisteredUserYptList, matchYptHandleToUid, YptUserEntry } from "./yptService";

export async function parseYptScreenshot(
  image: { base64: string; mimeType: string },
  rules: YptRuleConfig,
  model: string = "gemini-3.1-flash-lite"
): Promise<YptExtractedMemberData[]> {
  const customKey = getActiveApiKey();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Fetch registered user profiles for accurate handle matching
  let registeredUsers: YptUserEntry[] = [];
  try {
    registeredUsers = await getRegisteredUserYptList();
  } catch (e) {
    console.warn("Could not fetch registered users for screenshot parsing:", e);
  }

  const response = await fetch("/api/parse-ypt-screenshot", {
    method: "POST",
    headers,
    body: JSON.stringify({
      image,
      rules,
      knownUsers: registeredUsers,
      customApiKey: customKey || null,
      model,
      featureKey: 'ypt_screenshot_parser',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error || "Failed to parse YPT screenshot";
    throw new Error(msg);
  }

  const data = await response.json();
  const members: YptExtractedMemberData[] = data.extractedMembers || [];

  // Client-side multi-tier matching safeguard
  if (registeredUsers.length > 0) {
    return members.map((m) => {
      if (!m.matchedUid && m.yptHandle) {
        const matchedUid = matchYptHandleToUid(m.yptHandle, registeredUsers);
        if (matchedUid) {
          return { ...m, matchedUid };
        }
      }
      return m;
    });
  }

  return members;
}

