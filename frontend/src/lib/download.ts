import { importKey, decryptChunk, decryptMetadata, deriveWrappingKey, unwrapFileKey, fromBase64Url } from "./crypto";
import { rechunkEncryptedStream } from "./chunker";
import { getMeta, claim, downloadBlob } from "./api";
import type { DecryptedMetadata, MetaResponse } from "@shared/types";

export interface DownloadState {
  phase: "loading" | "password" | "ready" | "downloading" | "decrypting" | "done" | "burned" | "error";
  metadata: DecryptedMetadata | null;
  metaResponse: MetaResponse | null;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
}

export async function fetchMetadata(dropId: string): Promise<MetaResponse> {
  return getMeta(dropId);
}

export async function prepareKey(
  fragmentKey: string,
  metaResponse: MetaResponse
): Promise<{ fileKey: CryptoKey; needsPassword: boolean }> {
  const keyBytes = fromBase64Url(fragmentKey);

  if (metaResponse.salt) {
    return { fileKey: null as unknown as CryptoKey, needsPassword: true };
  }

  if (keyBytes.length !== 32) {
    throw new Error(`Invalid key length: expected 32 bytes, got ${keyBytes.length}`);
  }

  const fileKey = await importKey(keyBytes);
  return { fileKey, needsPassword: false };
}

export async function unlockWithPassword(
  fragmentKey: string,
  password: string,
  salt: string
): Promise<CryptoKey> {
  const wrappedKey = fromBase64Url(fragmentKey);
  if (wrappedKey.length !== 40) {
    throw new Error(`Invalid wrapped key length: expected 40 bytes, got ${wrappedKey.length}`);
  }

  const saltBytes = fromBase64Url(salt);
  const wrappingKey = await deriveWrappingKey(password, saltBytes);

  try {
    return await unwrapFileKey(wrappedKey, wrappingKey);
  } catch {
    throw new Error("Incorrect password. The decryption key could not be unwrapped.");
  }
}

export async function decryptAndDownload(
  dropId: string,
  fileKey: CryptoKey,
  metaResponse: MetaResponse,
  onProgress: (current: number, total: number) => void
): Promise<{ blob: Blob; metadata: DecryptedMetadata }> {
  // Decrypt metadata
  const metadata = await decryptMetadata(fileKey, metaResponse.meta, metaResponse.metaIv);

  // Claim download
  const claimResult = await claim(dropId);
  if (!claimResult.allowed) {
    throw new Error("gone");
  }

  // Download encrypted blob
  const stream = await downloadBlob(dropId, claimResult.downloadToken);

  // Decrypt stream
  const decryptedParts: Uint8Array[] = [];
  let processedChunks = 0;

  for await (const { wireChunk, index } of rechunkEncryptedStream(stream, metadata.totalChunks)) {
    const plaintext = await decryptChunk(
      fileKey,
      wireChunk,
      index,
      metadata.totalChunks,
      dropId
    );
    decryptedParts.push(plaintext);
    processedChunks++;
    onProgress(processedChunks, metadata.totalChunks);
  }

  // Truncation check
  if (processedChunks !== metadata.totalChunks) {
    throw new Error(
      `Truncation detected: expected ${metadata.totalChunks} chunks but only received ${processedChunks}. The download may have been tampered with or interrupted.`
    );
  }

  const blob = new Blob(decryptedParts, { type: metadata.mimeType });
  return { blob, metadata };
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
