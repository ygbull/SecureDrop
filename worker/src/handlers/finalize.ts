import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata, FinalizeRequest } from "../../../shared/types";

export async function handleFinalize(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<FinalizeRequest>();

  if (!body.dropId) {
    return c.json({ error: "missing_drop_id" }, 400);
  }

  const kvRaw = await c.env.DROPS_META.get(`drop:${body.dropId}`);
  if (!kvRaw) {
    return c.json({ error: "drop_not_found" }, 404);
  }

  const kvData: DropMetadata = JSON.parse(kvRaw);
  if (kvData.status !== "pending") {
    return c.json({ error: "already_active" }, 400);
  }

  const listed = await c.env.DROPS_BUCKET.list({
    prefix: `drops/${body.dropId}/`,
  });
  if (listed.objects.length !== kvData.totalChunks) {
    return c.json(
      {
        error: "chunk_count_mismatch",
        expected: kvData.totalChunks,
        found: listed.objects.length,
      },
      400
    );
  }

  const result = await c.env.DB.prepare(
    "UPDATE drops SET status = 'active' WHERE id = ? AND status = 'pending'"
  )
    .bind(body.dropId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "already_active_or_missing" }, 409);
  }

  const updatedKv: DropMetadata = { ...kvData, status: "active" };
  await c.env.DROPS_META.put(
    `drop:${body.dropId}`,
    JSON.stringify(updatedKv),
    { expirationTtl: kvData.expiry + 86400 }
  );

  return c.json({ status: "active" });
}
