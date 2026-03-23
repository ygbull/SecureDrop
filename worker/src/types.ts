export interface Env {
  DROPS_BUCKET: R2Bucket;
  DROPS_META: KVNamespace;
  DB: D1Database;
  MAX_FILE_SIZE: string;
  DEFAULT_EXPIRY: string;
  ALLOWED_ORIGIN: string;
}
