import type { Context, Next } from "hono";
import type { Env } from "../types";

const SKIP_PATHS = ["/api/upload-part", "/api/finalize"];

const ACTION_MAP: Record<string, { action: string; ttl: number }> = {
  "/api/init-upload": { action: "init-upload", ttl: 60 },
  "/api/claim/": { action: "claim", ttl: 60 },
  "/api/dl/": { action: "download", ttl: 60 },
  "/api/drop/": { action: "delete", ttl: 60 },
};

export async function rateLimit(c: Context<{ Bindings: Env }>, next: Next) {
  const path = new URL(c.req.url).pathname;

  if (SKIP_PATHS.includes(path) || path.startsWith("/api/meta/")) {
    return next();
  }

  const match = Object.entries(ACTION_MAP).find(([prefix]) =>
    path.startsWith(prefix)
  );
  if (!match) return next();

  const { action, ttl } = match[1];
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";

  // For resource-specific endpoints, scope the rate limit to the resource ID
  // so rate limiting one drop doesn't block operations on other drops.
  // For init-upload, scope to IP only.
  let resourceId = "";
  if (action !== "init-upload") {
    const parts = path.split("/");
    resourceId = parts[parts.length - 1] || "";
  }

  const key = resourceId
    ? `rl:${ip}:${action}:${resourceId}`
    : `rl:${ip}:${action}`;

  const existing = await c.env.DROPS_META.get(key);
  if (existing) {
    return c.json({ error: "rate_limited" }, 429);
  }
  await c.env.DROPS_META.put(key, "1", { expirationTtl: ttl });
  return next();
}
