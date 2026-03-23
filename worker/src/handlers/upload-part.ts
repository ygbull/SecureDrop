import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata } from "../../../shared/types";

export async function handleUploadPart(c: Context<{ Bindings: Env }>) {
  const dropId = c.req.query("dropId");
  const partNumberStr = c.req.query("partNumber");

  if (!dropId || !partNumberStr) {
    return c.json({ error: "missing_params" }, 400);
  }

  const partNumber = parseInt(partNumberStr, 10);
  if (isNaN(partNumber) || partNumber < 1) {
    return c.json({ error: "invalid_part_number" }, 400);
  }

  const kvRaw = await c.env.DROPS_META.get(`drop:${dropId}`);
  if (!kvRaw) {
    return c.json({ error: "drop_not_found" }, 404);
  }

  const kvData: DropMetadata = JSON.parse(kvRaw);
  if (kvData.status !== "pending") {
    return c.json({ error: "drop_not_pending" }, 400);
  }

  if (partNumber > kvData.totalChunks) {
    return c.json({ error: "part_number_exceeds_total" }, 400);
  }

  const key = `drops/${dropId}/chunk-${String(partNumber).padStart(3, "0")}`;
  const body = await c.req.arrayBuffer();
  await c.env.DROPS_BUCKET.put(key, body);

  return c.json({ partNumber });
}
