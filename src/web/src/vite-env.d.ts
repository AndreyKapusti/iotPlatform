/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTROL_URL: string;
  readonly VITE_INGEST_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
