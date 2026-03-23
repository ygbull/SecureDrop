import type { Env } from "../types";

export async function handleScheduledCleanup(env: Env) {
  // Clean up exhausted drops (1-hour grace after exhausted_at)
  const exhausted = await env.DB.prepare(
    "SELECT id FROM drops WHERE exhausted_at IS NOT NULL AND exhausted_at < datetime('now', '-1 hour')"
  ).all<{ id: string }>();

  for (const row of exhausted.results) {
    await cleanupDrop(env, row.id);
  }

  // Clean up expired drops (8-day threshold)
  const expired = await env.DB.prepare(
    "DELETE FROM drops WHERE created_at < datetime('now', '-8 days')"
  ).run();

  // Clean up orphaned pending uploads (1-hour grace)
  const orphans = await env.DB.prepare(
    "SELECT id FROM drops WHERE status = 'pending' AND created_at < datetime('now', '-1 hour')"
  ).all<{ id: string }>();

  for (const row of orphans.results) {
    await cleanupDrop(env, row.id);
  }
}

async function cleanupDrop(env: Env, dropId: string) {
  const listed = await env.DROPS_BUCKET.list({ prefix: `drops/${dropId}/` });
  await Promise.all(listed.objects.map((o) => env.DROPS_BUCKET.delete(o.key)));
  await env.DROPS_META.delete(`drop:${dropId}`);
  await env.DB.prepare("DELETE FROM drops WHERE id = ?").bind(dropId).run();
}
