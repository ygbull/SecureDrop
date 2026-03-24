import type { Env } from "../types";

export async function handleScheduledCleanup(env: Env): Promise<void> {
  let cleanedCount = 0;
  let errorCount = 0;

  // Clean up exhausted drops (1-hour grace after exhausted_at)
  const exhausted = await env.DB.prepare(
    "SELECT id FROM drops WHERE exhausted_at IS NOT NULL AND exhausted_at < datetime('now', '-1 hour')"
  ).all<{ id: string }>();

  for (const row of exhausted.results) {
    try {
      await cleanupDrop(env, row.id);
      cleanedCount++;
    } catch (e) {
      console.error("Cleanup failed for exhausted drop:", row.id, e);
      errorCount++;
    }
  }

  // Clean up expired drops — check KV TTL to confirm actual expiry
  const oldDrops = await env.DB.prepare(
    `SELECT id FROM drops
     WHERE exhausted_at IS NULL
       AND status = 'active'
       AND created_at < datetime('now', '-7 days')`
  ).all<{ id: string }>();

  for (const row of oldDrops.results) {
    const kvRaw = await env.DROPS_META.get(`drop:${row.id}`);
    if (kvRaw === null) {
      try {
        await cleanupDrop(env, row.id);
        cleanedCount++;
      } catch (e) {
        console.error("Cleanup failed for expired drop:", row.id, e);
        errorCount++;
      }
    }
  }

  // Clean up orphaned pending uploads (1-hour grace)
  const orphans = await env.DB.prepare(
    "SELECT id FROM drops WHERE status = 'pending' AND created_at < datetime('now', '-1 hour')"
  ).all<{ id: string }>();

  for (const row of orphans.results) {
    try {
      await cleanupDrop(env, row.id);
      cleanedCount++;
    } catch (e) {
      console.error("Cleanup failed for orphaned pending drop:", row.id, e);
      errorCount++;
    }
  }

  console.log(`Cleanup complete. Cleaned: ${cleanedCount}, Errors: ${errorCount}`);
}

// Sequential R2 → KV → D1: D1 is the cron's index, so it must be deleted
// last to preserve retry capability if R2 or KV deletion fails.
async function cleanupDrop(env: Env, dropId: string): Promise<void> {
  const listed = await env.DROPS_BUCKET.list({ prefix: `drops/${dropId}/` });
  await Promise.all(listed.objects.map((o) => env.DROPS_BUCKET.delete(o.key)));
  await env.DROPS_META.delete(`drop:${dropId}`);
  await env.DB.prepare("DELETE FROM drops WHERE id = ?").bind(dropId).run();
}
