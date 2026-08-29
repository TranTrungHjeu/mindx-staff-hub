import { loginToLms, LmsSession } from "./lms/auth";

let cachedSession: LmsSession | null = null;
let activeLoginPromise: Promise<LmsSession> | null = null;

export async function getValidLmsToken(): Promise<string> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.token;
  }

  if (activeLoginPromise) {
    const session = await activeLoginPromise;
    return session.token;
  }

  try {
    activeLoginPromise = loginToLms();
    cachedSession = await activeLoginPromise;
    return cachedSession.token;
  } finally {
    activeLoginPromise = null;
  }
}
