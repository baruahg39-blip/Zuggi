/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZUGGI_MERCHANT_UPI?: string;
  readonly VITE_ZUGGI_MERCHANT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
