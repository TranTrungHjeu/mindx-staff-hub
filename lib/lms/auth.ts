import axios from "axios";
import { LMS_CONFIG } from "./config";

export interface LmsSession {
  token: string;
  expiresAt: number;
}

export async function loginToLms(
  username = LMS_CONFIG.teUsername,
  password = LMS_CONFIG.tePassword
): Promise<LmsSession> {
  // Step 1: Query loginWithUsername mutation from base-api
  const query = `mutation loginWithUsername($username: String!, $password: String!) {
    users {
      loginWithUsername(
        loginWithUsernameInput: {username: $username, password: $password}
      ) {
        customToken
        __typename
      }
      __typename
    }
  }`;

  const loginRes = await axios.post(
    "https://base-api.mindx.edu.vn/",
    {
      operationName: "loginWithUsername",
      variables: { username, password },
      query,
    },
    {
      headers: {
        "Content-Type": "application/json",
        origin: "https://base.mindx.edu.vn",
        referer: "https://base.mindx.edu.vn/",
      },
      timeout: 15000,
    }
  );

  if (loginRes.data?.errors) {
    throw new Error(
      loginRes.data.errors[0]?.message || "LMS Username authentication failed"
    );
  }

  const customToken =
    loginRes.data?.data?.users?.loginWithUsername?.customToken;
  if (!customToken) {
    throw new Error("LMS API did not return customToken");
  }

  // Step 2: Exchange customToken for Firebase ID Token (LMS Token)
  const firebaseRes = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${LMS_CONFIG.firebaseApiKey}`,
    { token: customToken, returnSecureToken: true },
    { timeout: 15000 }
  );

  const token = firebaseRes.data?.idToken;
  if (!token) {
    throw new Error("Firebase signInWithCustomToken failed");
  }

  return {
    token,
    expiresAt: Date.now() + 55 * 60 * 1000, // Token valid for 55 mins
  };
}
