/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: "mainnet" | "sandbox";
  readonly VITE_RPC_URL?: string;
  readonly VITE_OPTIONS_CONTRACT?: string;
  readonly VITE_INTENTS_CONTRACT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
