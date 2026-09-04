/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_CENTRE_IDS: string;
  readonly VITE_PAYROLL_PASSWORD: string;
  readonly VITE_LMS_GATEWAY_URL: string;
  readonly VITE_LMS_BASE_URL: string;
  readonly VITE_FIREBASE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
