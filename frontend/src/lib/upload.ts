import { generateKey, exportKey, encryptChunk, encryptMetadata, deriveWrappingKey, wrapFileKey, toBase64Url } from "./crypto";
import { chunkFile, calculateTotalChunks } from "./chunker";
import { initUpload, uploadPart, finalize } from "./api";
import type { DecryptedMetadata } from "@shared/types";

export interface UploadOptions {
  file: File;
  expiry: number;
  maxDownloads: number;
  password: string;
  onProgress: (state: UploadProgress) => void;
}

export interface UploadProgress {
  phase: "encrypting" | "uploading" | "finalizing" | "done";
  encryptProgress: number;
  uploadProgress: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
}

export interface UploadResult {
  shareUrl: string;
  dropId: string;
  deleteToken: string;
  expiresAt: string;
}

export function validateUploadOptions(opts: {
  file: File | null;
  passwordEnabled: boolean;
  password: string;
}): string | null {
  if (!opts.file) return "No file selected";
  if (opts.passwordEnabled && opts.password.trim().length === 0) {
    return "Password is required when password protection is enabled";
  }
  return null;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

export async function handleUpload(opts: UploadOptions): Promise<UploadResult> {
  const { file, expiry, maxDownloads, password, onProgress } = opts;
  const totalChunks = calculateTotalChunks(file.size);

  const progress: UploadProgress = {
    phase: "encrypting",
    encryptProgress: 0,
    uploadProgress: 0,
    currentChunk: 0,
    totalChunks,
    error: null,
  };

  // Step 1: Generate key
  const fileKey = await generateKey();
  const rawKey = await exportKey(fileKey);

  // Step 2: Handle password protection
  let fragmentBytes: Uint8Array;
  let salt: string | undefined;

  if (password.trim().length > 0) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    salt = toBase64Url(saltBytes);
    const wrappingKey = await deriveWrappingKey(password, saltBytes);
    const wrappedKey = await wrapFileKey(fileKey, wrappingKey);
    fragmentBytes = wrappedKey;
  } else {
    fragmentBytes = rawKey;
  }

  // Step 3: Encrypt metadata
  const metadata: DecryptedMetadata = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    totalChunks,
  };
  const { encryptedMeta, metaIv } = await encryptMetadata(fileKey, metadata);

  // Step 4: Init upload (need dropId before encrypting chunks for AAD)
  const initResponse = await initUpload({
    meta: encryptedMeta,
    metaIv,
    salt,
    expiry,
    maxDownloads,
    totalChunks,
    fileSize: file.size,
  });

  const { dropId, deleteToken, expiresAt } = initResponse;

  // Step 5: Encrypt and upload chunks
  progress.phase = "encrypting";
  onProgress({ ...progress });

  let chunkNum = 0;
  for await (const { chunk, index, total } of chunkFile(file)) {
    chunkNum++;
    progress.currentChunk = chunkNum;
    progress.phase = "encrypting";
    progress.encryptProgress = Math.round((chunkNum / total) * 100);
    onProgress({ ...progress });

    const wireChunk = await encryptChunk(fileKey, chunk, index, total, dropId);

    progress.phase = "uploading";
    onProgress({ ...progress });

    await withRetry(() => uploadPart(dropId, index + 1, wireChunk));

    progress.uploadProgress = Math.round((chunkNum / total) * 100);
    onProgress({ ...progress });
  }

  // Step 6: Finalize
  progress.phase = "finalizing";
  onProgress({ ...progress });

  await finalize({ dropId });

  // Step 7: Build share URL
  const fragment = toBase64Url(fragmentBytes);
  const shareUrl = `${window.location.origin}/d/${dropId}#${fragment}`;

  progress.phase = "done";
  progress.encryptProgress = 100;
  progress.uploadProgress = 100;
  onProgress({ ...progress });

  return { shareUrl, dropId, deleteToken, expiresAt };
}
