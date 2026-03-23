import { describe, it, expect } from "vitest";
import { calculateTotalChunks, rechunkEncryptedStream } from "../chunker";
import { PLAINTEXT_CHUNK_SIZE, WIRE_CHUNK_SIZE } from "@shared/constants";

function randomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += 65536) {
    const len = Math.min(65536, size - offset);
    crypto.getRandomValues(buf.subarray(offset, offset + len));
  }
  return buf;
}

describe("chunker", () => {
  // Test 1: Chunk count calculation
  it("calculates correct chunk counts", () => {
    expect(calculateTotalChunks(0)).toBe(1);
    expect(calculateTotalChunks(1)).toBe(1);
    expect(calculateTotalChunks(2097152)).toBe(1);
    expect(calculateTotalChunks(2097153)).toBe(2);
    expect(calculateTotalChunks(5 * 1024 * 1024)).toBe(3);
    expect(calculateTotalChunks(104857600)).toBe(50);
  });

  // Test 2: Chunk boundaries (using Uint8Array directly since File requires browser)
  it("chunk boundaries are correct for 5MB", () => {
    const fileSize = 5 * 1024 * 1024;
    const totalChunks = calculateTotalChunks(fileSize);
    expect(totalChunks).toBe(3);

    const chunk0Size = PLAINTEXT_CHUNK_SIZE;
    const chunk1Size = PLAINTEXT_CHUNK_SIZE;
    const chunk2Size = fileSize - 2 * PLAINTEXT_CHUNK_SIZE;

    expect(chunk0Size).toBe(2097152);
    expect(chunk1Size).toBe(2097152);
    expect(chunk2Size).toBe(1048576);
    expect(chunk0Size + chunk1Size + chunk2Size).toBe(fileSize);
  });

  // Test 3: Exact 2MB file
  it("exactly 2MB file is 1 chunk", () => {
    expect(calculateTotalChunks(2097152)).toBe(1);
  });

  // Test 4: Empty file
  it("empty file produces 1 chunk", () => {
    expect(calculateTotalChunks(0)).toBe(1);
  });

  // Test 5: 1-byte file
  it("1-byte file produces 1 chunk", () => {
    expect(calculateTotalChunks(1)).toBe(1);
  });

  // Test 6: Stream reassembly -- exact boundaries
  it("rechunks stream into exact WIRE_CHUNK_SIZE boundaries", { timeout: 30000 }, async () => {
    const totalSize = 3 * WIRE_CHUNK_SIZE;
    const data = randomBytes(totalSize);

    // Deliver in arbitrary-sized pieces
    const pieces: Uint8Array[] = [];
    let offset = 0;
    while (offset < totalSize) {
      const pieceSize = Math.min(
        1000 + Math.floor(Math.random() * 50000),
        totalSize - offset
      );
      pieces.push(data.slice(offset, offset + pieceSize));
      offset += pieceSize;
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) {
          controller.enqueue(piece);
        }
        controller.close();
      },
    });

    const wireChunks: Uint8Array[] = [];
    for await (const { wireChunk } of rechunkEncryptedStream(stream, 3)) {
      wireChunks.push(wireChunk);
    }

    expect(wireChunks.length).toBe(3);
    expect(wireChunks[0].length).toBe(WIRE_CHUNK_SIZE);
    expect(wireChunks[1].length).toBe(WIRE_CHUNK_SIZE);
    expect(wireChunks[2].length).toBe(WIRE_CHUNK_SIZE);

    const reassembled = new Uint8Array(totalSize);
    let off = 0;
    for (const wc of wireChunks) {
      reassembled.set(wc, off);
      off += wc.length;
    }
    expect(reassembled).toEqual(data);
  });

  // Test 7: Stream reassembly -- last chunk smaller
  it("rechunks with smaller last chunk", async () => {
    const lastChunkSize = 500028;
    const totalSize = 2 * WIRE_CHUNK_SIZE + lastChunkSize;
    const data = randomBytes(totalSize);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let offset = 0;
        while (offset < totalSize) {
          const pieceSize = Math.min(65536, totalSize - offset);
          controller.enqueue(data.slice(offset, offset + pieceSize));
          offset += pieceSize;
        }
        controller.close();
      },
    });

    const wireChunks: Uint8Array[] = [];
    for await (const { wireChunk } of rechunkEncryptedStream(stream, 3)) {
      wireChunks.push(wireChunk);
    }

    expect(wireChunks.length).toBe(3);
    expect(wireChunks[0].length).toBe(WIRE_CHUNK_SIZE);
    expect(wireChunks[1].length).toBe(WIRE_CHUNK_SIZE);
    expect(wireChunks[2].length).toBe(lastChunkSize);
  });

  // Test 8: Stream reassembly -- single chunk
  it("rechunks single partial chunk", async () => {
    const totalSize = 500028;
    const data = randomBytes(totalSize);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const wireChunks: Uint8Array[] = [];
    for await (const { wireChunk } of rechunkEncryptedStream(stream, 1)) {
      wireChunks.push(wireChunk);
    }

    expect(wireChunks.length).toBe(1);
    expect(wireChunks[0].length).toBe(totalSize);
  });
});
