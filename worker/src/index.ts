import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { rateLimit } from "./middleware/rateLimit";
import { handleInitUpload } from "./handlers/init-upload";
import { handleUploadPart } from "./handlers/upload-part";
import { handleFinalize } from "./handlers/finalize";
import { handleMetadata } from "./handlers/metadata";
import { handleClaim } from "./handlers/claim";
import { handleDownload } from "./handlers/download";
import { handleDelete } from "./handlers/delete";
import { handleScheduledCleanup } from "./handlers/cleanup";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
});

app.use("/api/*", async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      if (
        origin === c.env.ALLOWED_ORIGIN ||
        origin === "http://localhost:5173" ||
        origin === "http://localhost:4173"
      ) {
        return origin;
      }
      return c.env.ALLOWED_ORIGIN;
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Delete-Token"],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

app.use("/api/*", rateLimit);

app.post("/api/init-upload", handleInitUpload);
app.post("/api/upload-part", handleUploadPart);
app.post("/api/finalize", handleFinalize);
app.get("/api/meta/:id", handleMetadata);
app.post("/api/claim/:id", handleClaim);
app.get("/api/dl/:id", handleDownload);
app.delete("/api/drop/:id", handleDelete);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(handleScheduledCleanup(env));
  },
};
