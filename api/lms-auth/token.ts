import axios from "axios";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }

  try {
    const username = process.env.LMS_TE_USERNAME;
    const password = process.env.LMS_TE_PASSWORD;
    const firebaseApiKey = process.env.FIREBASE_API_KEY;

    if (!username || !password || !firebaseApiKey) {
      throw new Error("Thiếu thông tin đăng nhập LMS (LMS_TE_USERNAME / LMS_TE_PASSWORD / FIREBASE_API_KEY) trong Environment Variables trên Vercel");
    }

    const query = `mutation loginWithUsername($username: String!, $password: String!) {
      users {
        loginWithUsername(
          loginWithUsernameInput: {username: $username, password: $password}
        ) { customToken }
      }
    }`;

    const loginRes = await axios.post(
      "https://base-api.mindx.edu.vn/graphql",
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
      throw new Error(loginRes.data.errors[0]?.message || "LMS Auth Error");
    }

    const customToken = loginRes.data?.data?.users?.loginWithUsername?.customToken;
    if (!customToken) {
      throw new Error("LMS API did not return customToken");
    }

    const firebaseRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      { token: customToken, returnSecureToken: true },
      { timeout: 15000 }
    );

    const token = firebaseRes.data?.idToken;
    if (!token) throw new Error("Firebase token error");

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Authentication failed" });
  }
}
