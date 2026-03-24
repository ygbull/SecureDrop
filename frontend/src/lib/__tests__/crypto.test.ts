import { describe, it, expect } from "vitest";
import {
  generateKey,
  encryptChunk,
  decryptChunk,
  encryptMetadata,
  decryptMetadata,
  deriveWrappingKey,
  wrapFileKey,
  unwrapFileKey,
} from "../crypto";
import {
  PLAINTEXT_CHUNK_SIZE,
  IV_SIZE,
  AUTH_TAG_SIZE,
  WIRE_CHUNK_SIZE,
} from "@shared/constants";
import type { DecryptedMetadata } from "@shared/types";

function randomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += 65536) {
    const len = Math.min(65536, size - offset);
    crypto.getRandomValues(buf.subarray(offset, offset + len));
  }
  return buf;
}

describe("crypto", () => {
  // Test 1: Single-chunk encrypt/decrypt round-trip
  it("single chunk encrypt then decrypt returns original plaintext", async () => {
    const key = await generateKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(100));
    const dropId = "test-drop-id";

    const wireChunk = await encryptChunk(key, plaintext, 0, 1, dropId);
    expect(wireChunk.length).toBe(IV_SIZE + 100 + AUTH_TAG_SIZE);

    const decrypted = await decryptChunk(key, wireChunk, 0, 1, dropId);
    expect(decrypted).toEqual(plaintext);
  });

  // Test 2: Multi-chunk round-trip (5MB = 3 chunks)
  it("5MB file splits into 3 chunks and round-trips correctly", { timeout: 30000 }, async () => {
    const key = await generateKey();
    const fileSize = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(fileSize / PLAINTEXT_CHUNK_SIZE);
    const dropId = "multi5mb";

    expect(totalChunks).toBe(3);

    const fullFile = randomBytes(fileSize);
    const wireChunks: Uint8Array[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * PLAINTEXT_CHUNK_SIZE;
      const end = Math.min(start + PLAINTEXT_CHUNK_SIZE, fileSize);
      wireChunks.push(
        await encryptChunk(key, fullFile.slice(start, end), i, totalChunks, dropId)
      );
    }

    expect(wireChunks[0].length).toBe(WIRE_CHUNK_SIZE);
    expect(wireChunks[1].length).toBe(WIRE_CHUNK_SIZE);
    expect(wireChunks[2].length).toBe(IV_SIZE + 1048576 + AUTH_TAG_SIZE);

    const decryptedParts: Uint8Array[] = [];
    for (let i = 0; i < totalChunks; i++) {
      decryptedParts.push(
        await decryptChunk(key, wireChunks[i], i, totalChunks, dropId)
      );
    }

    const reassembled = new Uint8Array(fileSize);
    let offset = 0;
    for (const part of decryptedParts) {
      reassembled.set(part, offset);
      offset += part.length;
    }

    expect(reassembled).toEqual(fullFile);
  });

  // Test 3: AAD tamper detection -- wrong chunk index
  it("decrypt with wrong chunk index throws", async () => {
    const key = await generateKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(512));
    const dropId = "test-drop-id";

    const wireChunk = await encryptChunk(key, plaintext, 0, 3, dropId);

    await expect(decryptChunk(key, wireChunk, 1, 3, dropId)).rejects.toThrow();
  });

  // Test 4: AAD tamper detection -- wrong total chunks
  it("decrypt with wrong total chunks throws", async () => {
    const key = await generateKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(512));
    const dropId = "test-drop-id";

    const wireChunk = await encryptChunk(key, plaintext, 0, 3, dropId);

    await expect(decryptChunk(key, wireChunk, 0, 5, dropId)).rejects.toThrow();
  });

  // Test 5: AAD tamper detection -- wrong dropId
  it("decrypt with wrong dropId throws", async () => {
    const key = await generateKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(512));

    const wireChunk = await encryptChunk(key, plaintext, 0, 1, "drop-aaa");

    await expect(
      decryptChunk(key, wireChunk, 0, 1, "drop-bbb")
    ).rejects.toThrow();
  });

  // Test 6: Wrong key detection
  it("decrypt with different key throws", async () => {
    const keyA = await generateKey();
    const keyB = await generateKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(256));
    const dropId = "keytest";

    const wireChunk = await encryptChunk(keyA, plaintext, 0, 1, dropId);

    await expect(decryptChunk(keyB, wireChunk, 0, 1, dropId)).rejects.toThrow();
  });

  // Test 7: Wire chunk size -- full chunk
  it("non-last encrypted chunk is exactly WIRE_CHUNK_SIZE", async () => {
    const key = await generateKey();
    const plaintext = randomBytes(PLAINTEXT_CHUNK_SIZE);
    const dropId = "sizetest";

    const wireChunk = await encryptChunk(key, plaintext, 0, 3, dropId);

    expect(wireChunk.length).toBe(WIRE_CHUNK_SIZE);
  });

  // Test 8: Wire chunk size -- partial last chunk
  it("last chunk is smaller than WIRE_CHUNK_SIZE", async () => {
    const key = await generateKey();
    const lastChunkPlaintext = randomBytes(500000);
    const dropId = "lastchunk";

    const wireChunk = await encryptChunk(key, lastChunkPlaintext, 0, 1, dropId);

    expect(wireChunk.length).toBe(IV_SIZE + 500000 + AUTH_TAG_SIZE);
    expect(wireChunk.length).toBeLessThan(WIRE_CHUNK_SIZE);
  });

  // Test 9: Exactly 2MB boundary
  it("exactly 2MB file is 1 chunk at exact WIRE_CHUNK_SIZE", async () => {
    const key = await generateKey();
    const fileSize = PLAINTEXT_CHUNK_SIZE;
    const totalChunks = Math.ceil(fileSize / PLAINTEXT_CHUNK_SIZE);
    const dropId = "boundary2mb";

    expect(totalChunks).toBe(1);

    const plaintext = randomBytes(fileSize);
    const wireChunk = await encryptChunk(key, plaintext, 0, totalChunks, dropId);

    expect(wireChunk.length).toBe(WIRE_CHUNK_SIZE);

    const decrypted = await decryptChunk(key, wireChunk, 0, totalChunks, dropId);
    expect(decrypted).toEqual(plaintext);
  });

  // Test 10: Metadata encrypt/decrypt round-trip
  it("metadata encrypt then decrypt returns original metadata", async () => {
    const key = await generateKey();
    const metadata: DecryptedMetadata = {
      fileName: "report.pdf",
      mimeType: "application/pdf",
      fileSize: 1048576,
      totalChunks: 1,
    };

    const { encryptedMeta, metaIv } = await encryptMetadata(key, metadata);
    const decrypted = await decryptMetadata(key, encryptedMeta, metaIv);

    expect(decrypted).toEqual(metadata);
  });

  // Test 11: Password wrap/unwrap round-trip
  it("password wrap then unwrap recovers the original file key", async () => {
    const fileKey = await generateKey();
    const password = "correct-horse-battery-staple";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const wrappingKey = await deriveWrappingKey(password, salt);
    const wrappedKey = await wrapFileKey(fileKey, wrappingKey);

    expect(wrappedKey.length).toBe(40);

    const unwrappingKey = await deriveWrappingKey(password, salt);
    const recoveredKey = await unwrapFileKey(wrappedKey, unwrappingKey);

    const testPlaintext = new TextEncoder().encode("test data for key verification");
    const wireChunk = await encryptChunk(recoveredKey, testPlaintext, 0, 1, "wraptest");
    const decrypted = await decryptChunk(recoveredKey, wireChunk, 0, 1, "wraptest");

    expect(decrypted).toEqual(testPlaintext);
  });

  // Test 12: Wrong password unwrap fails
  it("wrong password unwrap throws", async () => {
    const fileKey = await generateKey();
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const wrappingKey = await deriveWrappingKey("correct-password", salt);
    const wrappedKey = await wrapFileKey(fileKey, wrappingKey);

    const wrongKey = await deriveWrappingKey("wrong-password", salt);

    await expect(unwrapFileKey(wrappedKey, wrongKey)).rejects.toThrow();
  });

  // Test 13: Empty plaintext (0 bytes)
  it("empty file (0 bytes) produces 1 chunk and round-trips", async () => {
    const key = await generateKey();
    const plaintext = new Uint8Array(0);
    const dropId = "emptytest";

    const wireChunk = await encryptChunk(key, plaintext, 0, 1, dropId);

    expect(wireChunk.length).toBe(IV_SIZE + AUTH_TAG_SIZE);

    const decrypted = await decryptChunk(key, wireChunk, 0, 1, dropId);
    expect(decrypted.length).toBe(0);
    expect(decrypted).toEqual(plaintext);
  });

  // Test 14: Each chunk gets a unique IV
  it("each chunk gets a unique IV", async () => {
    const key = await generateKey();
    const data = crypto.getRandomValues(new Uint8Array(100));

    const wireA = await encryptChunk(key, data, 0, 2, "test");
    const wireB = await encryptChunk(key, data, 1, 2, "test");

    const ivA = wireA.slice(0, IV_SIZE);
    const ivB = wireB.slice(0, IV_SIZE);

    let same = true;
    for (let i = 0; i < IV_SIZE; i++) {
      if (ivA[i] !== ivB[i]) {
        same = false;
        break;
      }
    }
    expect(same).toBe(false);
  });
});
