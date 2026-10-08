/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'eazybi';
  readonly VITE_SNAPSHOT_URL?: string;
}
