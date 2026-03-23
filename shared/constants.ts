export const PLAINTEXT_CHUNK_SIZE = 2 * 1024 * 1024; // 2,097,152 bytes (2MB)
export const IV_SIZE = 12; // AES-GCM standard 96-bit IV
export const AUTH_TAG_SIZE = 16; // AES-GCM 128-bit authentication tag
export const ENCRYPTED_CHUNK_SIZE =
  PLAINTEXT_CHUNK_SIZE + AUTH_TAG_SIZE; // 2,097,168 bytes
export const WIRE_CHUNK_SIZE =
  IV_SIZE + ENCRYPTED_CHUNK_SIZE; // 2,097,180 bytes

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const PBKDF2_ITERATIONS = 100_000;
export const AES_KEY_LENGTH = 256; // bits

export const EXPIRY_OPTIONS = [
  { label: "1 hour", value: 3600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
] as const;

export const DOWNLOAD_LIMIT_OPTIONS = [
  { label: "1 download", value: 1 },
  { label: "5 downloads", value: 5 },
  { label: "20 downloads", value: 20 },
  { label: "Unlimited", value: 0 },
] as const;
