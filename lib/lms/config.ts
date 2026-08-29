export const LMS_CONFIG = {
  gatewayUrl: process.env.LMS_GATEWAY_URL || "https://lms-api.mindx.edu.vn/",
  baseUrl: process.env.LMS_BASE_URL || "https://base-api.mindx.edu.vn/",
  origin: process.env.LMS_ORIGIN || "https://lms.mindx.edu.vn",
  referer: process.env.LMS_REFERER || "https://lms.mindx.edu.vn/",
  firebaseApiKey:
    process.env.FIREBASE_API_KEY ||
    "AIzaSyAh2Au-mk5ci-hN83RUBqj1fsAmCMdvJx4",
  teUsername: process.env.TE_USERNAME || "I3470",
  tePassword: process.env.TE_PASSWORD || "MindX@2024",
};
