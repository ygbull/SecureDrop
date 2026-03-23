# SecureDrop

Dead simple encrypted file sharing. Files are encrypted in your browser before they ever touch the server. The decryption key lives in the URL fragment — the part after `#` that browsers never send to servers. Even if the server is fully compromised, your files stay private.

**[drop.haijieqin.com](https://drop.haijieqin.com)**

## How it works

1. You drop a file. The browser encrypts it with AES-256-GCM, splitting it into 2MB chunks.
2. The encrypted blobs get uploaded to Cloudflare R2. The server stores opaque ciphertext it can never read.
3. You get a share link. The decryption key is in the `#fragment` — it never leaves your browser, never hits the server, never gets logged.
4. The recipient opens the link. Their browser pulls the key from the fragment, downloads the encrypted blobs, decrypts everything client-side, and saves the original file.

That's it. The server is a dumb pipe for encrypted bytes.

## Features

- **Zero-knowledge** — the server literally cannot decrypt your files
- **Burn after reading** — set download limits (1, 5, 20, or unlimited)
- **Auto-expiry** — files self-destruct after 1 hour, 24 hours, or 7 days
- **Password protection** — optional PBKDF2 key wrapping on top of the link
- **No accounts** — no sign-up, no login, no tracking
- **QR codes** — for easy sharing to mobile
- **$0/month** — runs entirely on Cloudflare's free tier

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| API | Cloudflare Workers (Hono) |
| Encryption | WebCrypto API (AES-256-GCM) |
| File storage | Cloudflare R2 |
| Metadata | Cloudflare KV (with TTL-based expiry) |
| Download counter | Cloudflare D1 (SQLite — atomic `UPDATE ... RETURNING`) |

## Security model

The crypto is straightforward and uses only browser-native APIs — no third-party crypto libraries.

- **AES-256-GCM** with unique random IVs per chunk
- **AAD (Additional Authenticated Data)** binds each chunk to its index, total count, and drop ID — prevents reordering, duplication, and cross-drop substitution
- **Truncation detection** — the client verifies it received all chunks before presenting the file
- **Fragment hygiene** — the key is stripped from browser history via `history.replaceState()` before any network request
- **PBKDF2 + AES-KW** for optional password protection (100k iterations, SHA-256)

The key never appears in HTTP requests, server logs, localStorage, cookies, or analytics. It exists only in JavaScript memory during the page session.

## Self-hosting

You'll need a free Cloudflare account.

### 1. Create resources

```bash
npx wrangler r2 bucket create secure-drops
npx wrangler kv namespace create DROPS_META
npx wrangler d1 create secure-drop-db
```

### 2. Configure the Worker

Copy the example config and fill in your IDs:

```bash
cp worker/wrangler.toml.example worker/wrangler.toml
```

Edit `worker/wrangler.toml` with the KV namespace ID and D1 database ID from step 1.

### 3. Deploy

```bash
# Run the database migration
cd worker
npx wrangler d1 execute secure-drop-db --remote --file=./src/db/schema.sql

# Deploy the Worker
npx wrangler deploy

# Build and deploy the frontend
cd ../frontend
npm install && npm run build
npx wrangler pages project create secure-drop
npx wrangler pages deploy dist --project-name=secure-drop
```

Then point your domain at the Pages project and add a Workers Route for `/api/*` in the Cloudflare dashboard.

## Local development

```bash
# Terminal 1 — Worker
cd worker
npm install
npx wrangler d1 execute secure-drop-db --local --file=./src/db/schema.sql
npx wrangler dev --local --persist-to=.wrangler/state

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the Worker at `localhost:8787`.

Create `worker/.dev.vars` for local overrides:
```
ALLOWED_ORIGIN=http://localhost:5173
```

## Tests

```bash
# Unit tests (crypto, chunking, utils — 27 tests)
cd frontend && npx vitest run

# API integration tests (19 tests, requires Worker running locally)
npx tsx scripts/test-api.ts
```

## Project structure

```
├── shared/              # Types and constants shared between frontend and worker
├── frontend/
│   └── src/
│       ├── components/  # React components
│       └── lib/         # Crypto, chunking, API client, upload/download orchestration
├── worker/
│   └── src/
│       ├── handlers/    # API route handlers
│       ├── middleware/   # Rate limiting
│       └── db/          # D1 schema
└── scripts/             # Integration test script
```

## License

MIT
