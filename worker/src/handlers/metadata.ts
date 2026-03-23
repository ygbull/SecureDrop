import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata } from "../../../shared/types";

export async function handleMetadata(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");

  const kvRaw = await c.env.DROPS_META.get(`drop:${id}`);
  if (!kvRaw) {
    return c.json({ error: "gone" }, 404);
  }

  const kvData: DropMetadata = JSON.parse(kvRaw);

  if (kvData.status !== "active") {
    return c.json({ error: "gone" }, 404);
  }

  if (new Date(kvData.expiresAt).getTime() < Date.now()) {
    return c.json({ error: "gone" }, 404);
  }

  return c.json({
    meta: kvData.meta,
    metaIv: kvData.metaIv,
    salt: kvData.salt,
    totalChunks: kvData.totalChunks,
    maxDownloads: kvData.maxDownloads,
    expiry: kvData.expiry,
    createdAt: kvData.createdAt,
  });
}
