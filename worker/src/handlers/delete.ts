import type { Context } from "hono";
import type { Env } from "../types";
import type { DropMetadata } from "../../../shared/types";
import { isValidDropId, isValidToken } from "../utils/validate";

export async function handleDelete(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  if (!id || !isValidDropId(id)) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const deleteToken = c.req.header("X-Delete-Token");
  if (!deleteToken) {
    return c.json({ error: "missing_token" }, 403);
  }
  if (!isValidToken(deleteToken)) {
    return c.json({ error: "invalid_token" }, 403);
  }

  const kvRaw = await c.env.DROPS_META.get(`drop:${id}`);
  if (!kvRaw) {
    return c.json({ error: "gone" }, 404);
  }

  const kvData: DropMetadata = JSON.parse(kvRaw);
  const encoder = new TextEncoder();
  const expected = encoder.encode(kvData.deleteToken);
  const received = encoder.encode(deleteToken);
  if (expected.byteLength !== received.byteLength ||
      !crypto.subtle.timingSafeEqual(expected, received)) {
    return c.json({ error: "invalid_token" }, 403);
  }

  const listed = await c.env.DROPS_BUCKET.list({
    prefix: `drops/${id}/`,
  });
  await Promise.all(listed.objects.map((o) => c.env.DROPS_BUCKET.delete(o.key)));

  await c.env.DROPS_META.delete(`drop:${id}`);

  await c.env.DB.prepare("DELETE FROM drops WHERE id = ?").bind(id).run();

  return c.body(null, 204);
}
