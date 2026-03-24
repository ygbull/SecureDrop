# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities through [GitHub Security Advisories](https://github.com/ygbull/SecureDrop/security/advisories/new). Don't open a public issue.

We'll acknowledge within 48 hours and aim to ship a fix within 7 days for critical issues.

## Threat Model

### Protected against

- **Compromised server** — R2, KV, and D1 only ever see ciphertext. The decryption key never touches the server.
- **Network eavesdropping** — Traffic is HTTPS. The key is in the URL fragment, which browsers don't send over the wire (RFC 3986).
- **Log exposure** — The key doesn't show up in HTTP requests, server logs, cookies, localStorage, or analytics. `history.replaceState` removes it from browser history before any network request fires.
- **Chunk tampering** — AAD binds each chunk to its index, total, and drop ID. Reorder, duplicate, truncate, or swap chunks across drops and decryption fails.

### NOT protected against

- **Compromised device** — If the machine is owned, the key and file are in memory. Game over.
- **Link interception** — The share URL *is* the key. Send it over an unencrypted channel and anyone who intercepts it can decrypt the file.
- **Weak passwords** — PBKDF2 with 100k iterations slows brute-force, but a bad password is still a bad password.
- **Malicious CDN** — Cloudflare serves the frontend JS. A compromised CDN could serve a modified bundle that leaks keys. This is true of any web-based E2EE app — the only real mitigation is subresource integrity or a native client.

## Crypto

All crypto is [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). No third-party libraries.

| Primitive | What it does |
|---|---|
| AES-256-GCM | Encrypts file chunks (random IV per chunk, 128-bit auth tag) |
| PBKDF2-SHA256 | Derives a wrapping key from a password (100k iterations) |
| AES-KW | Wraps the file key with the password-derived key |
| `crypto.getRandomValues` | IVs, IDs, tokens |

## Key lifecycle

A 256-bit AES-GCM key is generated in the browser via `crypto.subtle.generateKey`. It encrypts the file chunks and metadata, gets base64url-encoded into the URL `#fragment`, and lives only in JS memory for the duration of the page session. It never hits localStorage, cookies, IndexedDB, or the server. When the page unloads, it's gone.

## Scope

**In scope:** Worker API endpoints, client-side crypto implementation, key/fragment handling, auth logic (download tokens, delete tokens, rate limiting).

**Out of scope:** Cloudflare infrastructure itself (R2, KV, D1, Workers runtime, Pages CDN), browser bugs, DoS against free-tier limits.
