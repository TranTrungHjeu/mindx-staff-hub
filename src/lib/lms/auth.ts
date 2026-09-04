import axios from "axios";

export interface LmsSession {
  token: string;
  expiresAt: number;
}

export async function loginToLms(): Promise<LmsSession> {
  const res = await axios.get("/api/lms-auth/token", { timeout: 15000 });
  if (res.data?.token && res.data?.expiresAt) {
    return {
      token: res.data.token,
      expiresAt: res.data.expiresAt,
    };
  }
  throw new Error(res.data?.error || "LMS Server Auth authentication failed");
}
