import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata } from "../../../shared/types";
import { isValidDropId } from "../utils/validate";

export async function handleMetadata(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id || !isValidDropId(id)) {
    return c.json({ error: "invalid_id" }, 400);
  }

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

  if (kvData.maxDownloads > 0) {
    const row = await c.env.DB.prepare(
      "SELECT downloads, max_downloads FROM drops WHERE id = ?"
    )
      .bind(id)
      .first<{ downloads: number; max_downloads: number }>();
    if (!row || row.downloads >= row.max_downloads) {
      return c.json({ error: "exhausted" }, 410);
    }
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
