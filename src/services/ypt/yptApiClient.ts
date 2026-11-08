import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { YptChallenge, YptApiGroup, YptApiMember, YptApiNativeChallenge } from "../../types/yptTypes";
import { normalizeHandle, extractAlpha } from "../../utils/yptUtils";

export const CHALLENGES_COLLECTION = "yptChallenges";

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date) && !(obj instanceof Timestamp)) {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        newObj[key] = sanitizeForFirestore(value);
      }
    }
    return newObj;
  }
  return obj;
}

export function getYptStoredCredentials() {
  const email = localStorage.getItem("ypt_email") || "";
  const password = localStorage.getItem("ypt_password") || "";
  const token = localStorage.getItem("ypt_token") || "";
  return { email, password, token };
}

export function saveYptCredentials(email: string, password?: string, token?: string) {
  if (email !== undefined) localStorage.setItem("ypt_email", email.trim());
  if (password !== undefined) localStorage.setItem("ypt_password", password);
  if (token !== undefined) localStorage.setItem("ypt_token", token.trim());
}

export function clearYptCredentials() {
  localStorage.removeItem("ypt_email");
  localStorage.removeItem("ypt_password");
  localStorage.removeItem("ypt_token");
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  const headers: Record<string, string> = {};
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const { email, password, token: yptToken } = getYptStoredCredentials();
  if (email) headers["x-ypt-email"] = email;
  if (password) headers["x-ypt-password"] = password;
  if (yptToken) headers["x-ypt-token"] = yptToken;

  return headers;
}

/**
 * Fetches joined YPT groups from the server proxy (/api/ypt/live-sync?action=get-groups).
 */
export async function fetchYptGroups(customCreds?: { email?: string; password?: string; token?: string }): Promise<{ groups: YptApiGroup[]; isDemo?: boolean; message?: string }> {
  const headers = await getAuthHeader();
  if (customCreds?.email) headers["x-ypt-email"] = customCreds.email;
  if (customCreds?.password) headers["x-ypt-password"] = customCreds.password;
  if (customCreds?.token) headers["x-ypt-token"] = customCreds.token;

  const res = await fetch("/api/ypt/live-sync?action=get-groups", { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT groups (${res.status})`);
  }
  const data = await res.json();
  return {
    groups: data.groups || [],
    isDemo: data.isDemo,
    message: data.message,
  };
}

/**
 * Fetches member rosters, study logs, and native challenge states from the server proxy.
 */
export async function fetchYptRoster(groupIds?: (number | string)[]): Promise<{
  roster: YptApiMember[];
  groups: YptApiGroup[];
  nativeChallenges: YptApiNativeChallenge[];
}> {
  const headers = await getAuthHeader();
  const gidsParam = Array.isArray(groupIds) && groupIds.length > 0 ? `&groupIds=${groupIds.join(",")}` : "";
  const res = await fetch(`/api/ypt/live-sync?action=get-roster${gidsParam}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT roster (${res.status})`);
  }
  const data = await res.json();
  return {
    roster: data.roster || data.members || [],
    groups: data.groups || [],
    nativeChallenges: data.nativeChallenges || [],
  };
}

export interface YptDayLogSubject {
  id: number | string;
  name: string;
  sm: number;
  hours: number;
  color?: string;
}

export interface YptDayLogResponse {
  date: string;
  totalMs: number;
  studyHours: number;
  subjects: YptDayLogSubject[];
  isDemo?: boolean;
  raw?: any;
  error?: string;
}

/**
 * Fetches real historical study logs from YPT for a given date (YYYY-MM-DD) via GET /logs/day?date=YYYY-MM-DD.
 */
export async function fetchYptDayLog(
  dateYmd: string,
  customCreds?: { email?: string; password?: string; token?: string }
): Promise<YptDayLogResponse> {
  const headers = await getAuthHeader();
  if (customCreds?.email) headers["x-ypt-email"] = customCreds.email;
  if (customCreds?.password) headers["x-ypt-password"] = customCreds.password;
  if (customCreds?.token) headers["x-ypt-token"] = customCreds.token;

  const res = await fetch(`/api/ypt/live-sync?action=get-day-log&date=${encodeURIComponent(dateYmd)}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT day log (${res.status})`);
  }
  const data = await res.json();
  return {
    date: data.date || dateYmd,
    totalMs: data.totalMs || 0,
    studyHours: data.studyHours || 0,
    subjects: data.subjects || [],
    isDemo: data.isDemo,
    raw: data.raw,
    error: data.error,
  };
}

/**
 * Fetches historical study logs from YPT for multiple dates in batch.
 */
export async function fetchYptDayLogs(
  dateYmds: string[],
  customCreds?: { email?: string; password?: string; token?: string }
): Promise<YptDayLogResponse[]> {
  if (!dateYmds || dateYmds.length === 0) return [];
  const headers = await getAuthHeader();
  if (customCreds?.email) headers["x-ypt-email"] = customCreds.email;
  if (customCreds?.password) headers["x-ypt-password"] = customCreds.password;
  if (customCreds?.token) headers["x-ypt-token"] = customCreds.token;

  const datesParam = dateYmds.join(",");
  const res = await fetch(`/api/ypt/live-sync?action=get-day-logs&dates=${encodeURIComponent(datesParam)}`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch YPT day logs (${res.status})`);
  }
  const data = await res.json();
  return (data.dayLogs || []).map((d: any) => ({
    date: d.date,
    totalMs: d.totalMs || 0,
    studyHours: d.studyHours || 0,
    subjects: d.subjects || [],
    isDemo: d.isDemo,
    raw: d.raw,
    error: d.error,
  }));
}

/**
 * Binds a user's Firebase account to their permanent YPT User ID (yptUd) in Firestore.
 */
export async function claimYptIdentity(
  appUserId: string,
  yptUd: number,
  yptHandle: string
): Promise<void> {
  const userRef = doc(db, "users", appUserId);
  const userSnap = await getDoc(userRef);

  let existingNames: string[] = [];
  if (userSnap.exists()) {
    const data = userSnap.data();
    if (Array.isArray(data.yptNames)) existingNames = data.yptNames;
    else if (data.yptName) existingNames = [data.yptName];
  }

  const cleanHandle = yptHandle.trim();
  const updatedNames = Array.from(new Set([...existingNames, cleanHandle]));

  await setDoc(
    userRef,
    {
      yptUd,
      yptName: cleanHandle,
      yptNames: updatedNames,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Matches YPT roster members against registered Firebase users in Firestore using yptUd first,
 * falling back to handle matching.
 */
export async function linkYptRosterToAppUsers(rosterMembers: YptApiMember[]): Promise<
  Array<{
    yptMember: YptApiMember;
    appUserId?: string;
    matchedHandle: string;
  }>
> {
  const usersRef = collection(db, "users");
  const usersSnap = await getDocs(usersRef);

  const appUsers: Array<{
    uid: string;
    yptUd?: number;
    displayName?: string;
    yptNames: string[];
  }> = [];

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const names = new Set<string>();
    if (Array.isArray(data.yptNames)) {
      data.yptNames.forEach((n: string) => n && names.add(String(n).trim()));
    }
    if (data.yptName) names.add(String(data.yptName).trim());
    if (data.displayName) names.add(String(data.displayName).trim());

    appUsers.push({
      uid: docSnap.id,
      yptUd: typeof data.yptUd === "number" ? data.yptUd : undefined,
      displayName: data.displayName,
      yptNames: Array.from(names),
    });
  });

  return rosterMembers.map((member) => {
    let matchedUser = appUsers.find((u) => u.yptUd === member.ud);

    if (!matchedUser) {
      const handleLower = member.n.toLowerCase().trim();
      matchedUser = appUsers.find((u) =>
        u.yptNames.some((name) => name.toLowerCase().trim() === handleLower)
      );
    }

    return {
      yptMember: member,
      appUserId: matchedUser?.uid,
      matchedHandle: matchedUser?.displayName || member.n,
    };
  });
}

/**
 * Retrieves all known YPT handles across user profiles and existing challenges.
 */
export async function getAllKnownYptNames(): Promise<string[]> {
  const namesSet = new Set<string>();

  try {
    const challengesCol = collection(db, CHALLENGES_COLLECTION);
    const challengesSnap = await getDocs(challengesCol);
    challengesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as YptChallenge;
      if (Array.isArray(data.teams)) {
        data.teams.forEach((team) => {
          if (Array.isArray(team.memberUids)) {
            team.memberUids.forEach((m) => {
              if (m && typeof m === 'string' && m.trim()) {
                namesSet.add(m.trim());
              }
            });
          }
        });
      }
    });
  } catch (err) {
    console.warn('Could not fetch challenges for YPT names:', err);
  }

  return Array.from(namesSet);
}

export interface YptUserEntry {
  uid: string;
  displayName?: string;
  yptNames: string[];
  defaultYptHandle?: string;
}

export { normalizeHandle, extractAlpha };

export function matchYptHandleToUid(
  handle: string,
  users: YptUserEntry[]
): string | undefined {
  if (!handle || !users || users.length === 0) return undefined;

  const rawTarget = handle.trim().toLowerCase();
  const cleanTarget = normalizeHandle(handle);
  const alphaTarget = extractAlpha(handle);

  // Pass 1: Exact raw match
  for (const user of users) {
    const allNames = [...(user.yptNames || [])];
    if (user.displayName) allNames.push(user.displayName);

    for (const name of allNames) {
      if (!name) continue;
      if (name.trim().toLowerCase() === rawTarget) {
        return user.uid;
      }
    }
  }

  // Pass 2: Clean normalized match (stripping @, variation selectors, extra spaces)
  for (const user of users) {
    const allNames = [...(user.yptNames || [])];
    if (user.displayName) allNames.push(user.displayName);

    for (const name of allNames) {
      if (!name) continue;
      if (normalizeHandle(name) === cleanTarget) {
        return user.uid;
      }
    }
  }

  // Pass 3: Alphanumeric base match
  if (alphaTarget.length >= 2) {
    for (const user of users) {
      const allNames = [...(user.yptNames || [])];
      if (user.displayName) allNames.push(user.displayName);

      for (const name of allNames) {
        if (!name) continue;
        const nameAlpha = extractAlpha(name);
        if (nameAlpha.length >= 2 && nameAlpha === alphaTarget) {
          return user.uid;
        }
      }
    }
  }

  // Pass 4: Substring / Sub-word match
  if (alphaTarget.length >= 3) {
    for (const user of users) {
      const allNames = [...(user.yptNames || [])];
      if (user.displayName) allNames.push(user.displayName);

      for (const name of allNames) {
        if (!name) continue;
        const nameAlpha = extractAlpha(name);
        if (nameAlpha.length >= 3 && (alphaTarget.includes(nameAlpha) || nameAlpha.includes(alphaTarget))) {
          return user.uid;
        }
      }
    }
  }

  return undefined;
}

export async function getRegisteredUserYptList(): Promise<YptUserEntry[]> {
  const users: YptUserEntry[] = [];
  try {
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);
    usersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const names = new Set<string>();
      if (Array.isArray(data.yptNames) && data.yptNames.length > 0) {
        data.yptNames.forEach((n: string) => {
          if (n && typeof n === 'string' && n.trim()) {
            names.add(n.trim());
          }
        });
      } else if (typeof data.yptName === 'string' && data.yptName.trim()) {
        names.add(data.yptName.trim());
      }
      const defaultHandle = typeof data.defaultYptHandle === 'string' && data.defaultYptHandle.trim()
        ? data.defaultYptHandle.trim()
        : undefined;

      if (names.size > 0) {
        users.push({
          uid: docSnap.id,
          displayName: data.displayName,
          yptNames: Array.from(names),
          defaultYptHandle: defaultHandle,
        });
      }
    });
  } catch (err) {
    console.warn('Could not fetch user profiles for YPT list:', err);
  }
  return users;
}
