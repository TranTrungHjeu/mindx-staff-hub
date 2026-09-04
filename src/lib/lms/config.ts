export const LMS_CONFIG = {
  gatewayUrl: import.meta.env.VITE_LMS_GATEWAY_URL || "/api/lms-gateway/",
  baseUrl: import.meta.env.VITE_LMS_BASE_URL || "/api/lms-base/",
  origin: "https://lms.mindx.edu.vn",
  referer: "https://lms.mindx.edu.vn/",
};
