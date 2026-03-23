import { IV_SIZE, PBKDF2_ITERATIONS } from "@shared/constants";
import type { DecryptedMetadata } from "@shared/types";

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(b64url: string): Uint8Array {
  let base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(paddingNeeded);
  return fromBase64(base64);
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptChunk(
  key: CryptoKey,
  plaintext: Uint8Array,
  chunkIndex: number,
  totalChunks: number,
  dropId: string
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

  const aadString = JSON.stringify({
    index: chunkIndex,
    total: totalChunks,
    dropId,
  });
  const aad = new TextEncoder().encode(aadString);

  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    key,
    plaintext
  );

  const wireChunk = new Uint8Array(IV_SIZE + ciphertextWithTag.byteLength);
  wireChunk.set(iv, 0);
  wireChunk.set(new Uint8Array(ciphertextWithTag), IV_SIZE);
  return wireChunk;
}

export async function decryptChunk(
  key: CryptoKey,
  wireChunk: Uint8Array,
  chunkIndex: number,
  totalChunks: number,
  dropId: string
): Promise<Uint8Array> {
  if (wireChunk.length < IV_SIZE + 16) {
    throw new Error(
      `Wire chunk too small: ${wireChunk.length} bytes, minimum is ${IV_SIZE + 16}`
    );
  }

  const iv = wireChunk.slice(0, IV_SIZE);
  const ciphertextWithTag = wireChunk.slice(IV_SIZE);

  const aadString = JSON.stringify({
    index: chunkIndex,
    total: totalChunks,
    dropId,
  });
  const aad = new TextEncoder().encode(aadString);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
      key,
      ciphertextWithTag
    );
  } catch (error) {
    throw new Error(
      `Decryption failed for chunk ${chunkIndex}/${totalChunks} (dropId: ${dropId}). ` +
        `The file may be corrupted, tampered with, or the decryption key may be wrong. ` +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return new Uint8Array(plaintext);
}

export async function encryptMetadata(
  key: CryptoKey,
  metadata: DecryptedMetadata
): Promise<{ encryptedMeta: string; metaIv: string }> {
  const plaintext = new TextEncoder().encode(JSON.stringify(metadata));
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    plaintext
  );

  return {
    encryptedMeta: toBase64(new Uint8Array(ciphertextWithTag)),
    metaIv: toBase64(new Uint8Array(iv)),
  };
}

export async function decryptMetadata(
  key: CryptoKey,
  encryptedMeta: string,
  metaIv: string
): Promise<DecryptedMetadata> {
  const ciphertextWithTag = fromBase64(encryptedMeta);
  const iv = fromBase64(metaIv);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    ciphertextWithTag
  );

  const json = new TextDecoder().decode(plaintext);
  const metadata: DecryptedMetadata = JSON.parse(json);

  if (typeof metadata.fileName !== "string" || metadata.fileName.length === 0) {
    throw new Error("Invalid metadata: missing or empty filename");
  }
  if (typeof metadata.mimeType !== "string") {
    throw new Error("Invalid metadata: missing MIME type");
  }
  if (typeof metadata.fileSize !== "number" || metadata.fileSize < 0) {
    throw new Error("Invalid metadata: invalid file size");
  }
  if (typeof metadata.totalChunks !== "number" || metadata.totalChunks < 1) {
    throw new Error("Invalid metadata: invalid totalChunks");
  }

  return metadata;
}

export async function deriveWrappingKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

export async function wrapFileKey(
  fileKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<Uint8Array> {
  const wrappedKeyBuffer = await crypto.subtle.wrapKey(
    "raw",
    fileKey,
    wrappingKey,
    "AES-KW"
  );
  return new Uint8Array(wrappedKeyBuffer);
}

export async function unwrapFileKey(
  wrappedKey: Uint8Array,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    wrappingKey,
    "AES-KW",
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}
