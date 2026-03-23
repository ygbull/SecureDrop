import { PLAINTEXT_CHUNK_SIZE, WIRE_CHUNK_SIZE } from "@shared/constants";

export function calculateTotalChunks(fileSize: number): number {
  if (fileSize === 0) return 1;
  return Math.ceil(fileSize / PLAINTEXT_CHUNK_SIZE);
}

export async function* chunkFile(
  file: File
): AsyncGenerator<{ chunk: Uint8Array; index: number; total: number }> {
  const totalChunks = calculateTotalChunks(file.size);

  if (file.size === 0) {
    yield { chunk: new Uint8Array(0), index: 0, total: 1 };
    return;
  }

  const reader = file.stream().getReader();
  let buffer = new Uint8Array(0);
  let chunkIndex = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer, 0);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
    }

    while (buffer.length >= PLAINTEXT_CHUNK_SIZE && chunkIndex < totalChunks - 1) {
      yield {
        chunk: buffer.slice(0, PLAINTEXT_CHUNK_SIZE),
        index: chunkIndex,
        total: totalChunks,
      };
      buffer = buffer.slice(PLAINTEXT_CHUNK_SIZE);
      chunkIndex++;
    }

    if (done) {
      if (buffer.length > 0 || chunkIndex === 0) {
        yield { chunk: buffer, index: chunkIndex, total: totalChunks };
      }
      break;
    }
  }
}

export async function* rechunkEncryptedStream(
  stream: ReadableStream<Uint8Array>,
  totalChunks: number
): AsyncGenerator<{ wireChunk: Uint8Array; index: number }> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);
  let chunkIndex = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (value) {
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer, 0);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
    }

    while (buffer.length >= WIRE_CHUNK_SIZE && chunkIndex < totalChunks - 1) {
      yield {
        wireChunk: buffer.slice(0, WIRE_CHUNK_SIZE),
        index: chunkIndex,
      };
      buffer = buffer.slice(WIRE_CHUNK_SIZE);
      chunkIndex++;
    }

    if (done) {
      if (buffer.length > 0) {
        yield { wireChunk: buffer, index: chunkIndex };
      }
      break;
    }
  }
}
