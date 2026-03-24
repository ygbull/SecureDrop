import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata } from "../../../shared/types";
import { isValidDropId, isValidToken } from "../utils/validate";
import {
  WIRE_CHUNK_SIZE,
  PLAINTEXT_CHUNK_SIZE,
  IV_SIZE,
  AUTH_TAG_SIZE,
} from "../../../shared/constants";

export async function handleDownload(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id || !isValidDropId(id)) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "missing_token" }, 403);
  }
  if (!isValidToken(token)) {
    return c.json({ error: "invalid_token" }, 403);
  }

  const tokenKey = `dl:${id}:${token}`;
  const valid = await c.env.DROPS_META.get(tokenKey);
  if (!valid) {
    return c.json({ error: "invalid_token" }, 403);
  }

  await c.env.DROPS_META.delete(tokenKey);

  const kvRaw = await c.env.DROPS_META.get(`drop:${id}`);
  if (!kvRaw) {
    return c.json({ error: "gone" }, 404);
  }

  const kvData: DropMetadata = JSON.parse(kvRaw);
  if (kvData.status !== "active") {
    return c.json({ error: "gone" }, 404);
  }

  const { totalChunks, fileSize } = kvData;

  let contentLength: number;
  if (totalChunks === 1) {
    contentLength = IV_SIZE + fileSize + AUTH_TAG_SIZE;
  } else {
    const lastPlaintextSize =
      fileSize - (totalChunks - 1) * PLAINTEXT_CHUNK_SIZE;
    const lastWireChunkSize = IV_SIZE + lastPlaintextSize + AUTH_TAG_SIZE;
    contentLength = (totalChunks - 1) * WIRE_CHUNK_SIZE + lastWireChunkSize;
  }

  let chunkIndex = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (chunkIndex >= totalChunks) {
        controller.close();
        return;
      }
      const key = `drops/${id}/chunk-${String(chunkIndex + 1).padStart(3, "0")}`;
      const obj = await c.env.DROPS_BUCKET.get(key);
      if (!obj) {
        controller.error(new Error(`Missing chunk ${chunkIndex + 1}`));
        return;
      }
      const bytes = new Uint8Array(await obj.arrayBuffer());
      controller.enqueue(bytes);
      chunkIndex++;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": contentLength.toString(),
    },
  });
}
