import type { Context } from "hono";
import type { Env } from "../types";
import type { InitUploadRequest, DropMetadata } from "../../../shared/types";
import { generateId } from "../utils/id";

const VALID_EXPIRY = [3600, 86400, 604800];
const VALID_MAX_DOWNLOADS = [0, 1, 5, 20];

export async function handleInitUpload(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<InitUploadRequest>();

  const maxFileSize = parseInt(c.env.MAX_FILE_SIZE, 10);
  if (!body.fileSize || body.fileSize > maxFileSize) {
    return c.json({ error: "file_too_large" }, 400);
  }
  if (!VALID_EXPIRY.includes(body.expiry)) {
    return c.json({ error: "invalid_expiry" }, 400);
  }
  if (!VALID_MAX_DOWNLOADS.includes(body.maxDownloads)) {
    return c.json({ error: "invalid_max_downloads" }, 400);
  }
  if (!body.totalChunks || body.totalChunks < 1 || body.totalChunks > 50) {
    return c.json({ error: "invalid_total_chunks" }, 400);
  }
  if (!body.meta || !body.metaIv) {
    return c.json({ error: "missing_metadata" }, 400);
  }

  let dropId = generateId(8);
  let collision = await c.env.DROPS_META.get(`drop:${dropId}`);
  while (collision !== null) {
    dropId = generateId(8);
    collision = await c.env.DROPS_META.get(`drop:${dropId}`);
  }

  const deleteToken = generateId(16);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + body.expiry * 1000).toISOString();

  const kvValue: DropMetadata = {
    meta: body.meta,
    metaIv: body.metaIv,
    salt: body.salt ?? null,
    expiry: body.expiry,
    maxDownloads: body.maxDownloads,
    totalChunks: body.totalChunks,
    fileSize: body.fileSize,
    status: "pending",
    deleteToken,
    createdAt,
    expiresAt,
  };

  await c.env.DROPS_META.put(`drop:${dropId}`, JSON.stringify(kvValue), {
    expirationTtl: body.expiry + 86400,
  });

  await c.env.DB.prepare(
    "INSERT INTO drops (id, max_downloads, downloads, status, created_at) VALUES (?, ?, 0, 'pending', datetime('now'))"
  )
    .bind(dropId, body.maxDownloads)
    .run();

  return c.json({ dropId, deleteToken, expiresAt }, 201);
}
