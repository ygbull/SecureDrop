import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata } from "../../../shared/types";
import { generateId } from "../utils/id";

export async function handleClaim(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");

  const kvRaw = await c.env.DROPS_META.get(`drop:${id}`);
  if (!kvRaw) {
    return c.json({ error: "gone", allowed: false, downloads: 0, maxDownloads: 0, downloadToken: "" }, 404);
  }

  const kvData: DropMetadata = JSON.parse(kvRaw);
  if (kvData.status !== "active") {
    return c.json({ error: "gone", allowed: false, downloads: 0, maxDownloads: 0, downloadToken: "" }, 404);
  }

  if (new Date(kvData.expiresAt).getTime() < Date.now()) {
    return c.json({ error: "gone", allowed: false, downloads: 0, maxDownloads: 0, downloadToken: "" }, 404);
  }

  const result = await c.env.DB.prepare(
    `UPDATE drops
     SET downloads = downloads + 1,
         exhausted_at = CASE
           WHEN max_downloads > 0 AND downloads + 1 >= max_downloads
           THEN datetime('now')
           ELSE NULL
         END
     WHERE id = ?
       AND status = 'active'
       AND (max_downloads = 0 OR downloads < max_downloads)
     RETURNING downloads, max_downloads, exhausted_at`
  )
    .bind(id)
    .first<{ downloads: number; max_downloads: number; exhausted_at: string | null }>();

  if (!result) {
    const fallback = await c.env.DB.prepare(
      "SELECT downloads, max_downloads FROM drops WHERE id = ?"
    )
      .bind(id)
      .first<{ downloads: number; max_downloads: number }>();

    if (!fallback) {
      return c.json({ error: "gone", allowed: false, downloads: 0, maxDownloads: 0, downloadToken: "" }, 404);
    }

    return c.json(
      {
        allowed: false,
        error: "exhausted" as const,
        downloads: fallback.downloads,
        maxDownloads: fallback.max_downloads,
        downloadToken: "",
      },
      410
    );
  }

  const downloadToken = generateId(16);
  await c.env.DROPS_META.put(`dl:${id}:${downloadToken}`, "1", {
    expirationTtl: 300,
  });

  return c.json({
    allowed: true,
    downloads: result.downloads,
    maxDownloads: result.max_downloads,
    downloadToken,
  });
}
