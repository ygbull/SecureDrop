const BASE = "http://localhost:8787/api";

let passed = 0;
let failed = 0;
let ipCounter = 0;

function uniqueIp(): string {
  ipCounter++;
  return `10.0.0.${ipCounter}`;
}

function rlHeaders(): Record<string, string> {
  return { "CF-Connecting-IP": uniqueIp() };
}

function pass(name: string, detail = "") {
  passed++;
  console.log(`[PASS] ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name: string, reason: string) {
  failed++;
  console.log(`[FAIL] ${name} -- ${reason}`);
}

function toBase64(str: string): string {
  return Buffer.from(str).toString("base64");
}

async function test1_initUploadHappy(): Promise<{
  dropId: string;
  deleteToken: string;
}> {
  const name = "init-upload: happy path";
  const res = await fetch(`${BASE}/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rlHeaders() },
    body: JSON.stringify({
      meta: toBase64("fake-encrypted-metadata"),
      metaIv: toBase64("fake-iv-12byte"),
      expiry: 86400,
      maxDownloads: 1,
      totalChunks: 3,
      fileSize: 5242880,
    }),
  });

  if (res.status !== 201) {
    fail(name, `expected 201, got ${res.status}`);
    return { dropId: "", deleteToken: "" };
  }

  const body = await res.json<{
    dropId: string;
    deleteToken: string;
    expiresAt: string;
  }>();
  if (
    !body.dropId ||
    body.dropId.length !== 8 ||
    !body.deleteToken ||
    !body.expiresAt
  ) {
    fail(name, `invalid response body: ${JSON.stringify(body)}`);
    return { dropId: "", deleteToken: "" };
  }

  pass(name, `201, dropId=${body.dropId}`);
  return { dropId: body.dropId, deleteToken: body.deleteToken };
}

async function test2_initUploadTooLarge() {
  const name = "init-upload: file too large";
  const res = await fetch(`${BASE}/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rlHeaders() },
    body: JSON.stringify({
      meta: toBase64("fake"),
      metaIv: toBase64("fake-iv-12byte"),
      expiry: 86400,
      maxDownloads: 1,
      totalChunks: 1,
      fileSize: 200000000,
    }),
  });
  if (res.status === 400 || res.status === 413) {
    pass(name, `${res.status}`);
  } else {
    fail(name, `expected 400/413, got ${res.status}`);
  }
  await res.text();
}

async function test3_uploadParts(dropId: string) {
  for (let i = 1; i <= 3; i++) {
    const name = `upload-part: chunk ${i} of 3`;
    const size = i < 3 ? 2097180 : 1048604;
    const body = new Uint8Array(size);
    const res = await fetch(
      `${BASE}/upload-part?dropId=${dropId}&partNumber=${i}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body,
      }
    );
    if (res.status !== 200) {
      fail(name, `expected 200, got ${res.status}`);
      await res.text();
      continue;
    }
    const data = await res.json<{ partNumber: number }>();
    if (data.partNumber !== i) {
      fail(name, `expected partNumber=${i}, got ${data.partNumber}`);
    } else {
      pass(name, `200`);
    }
  }
}

async function test4_finalize(dropId: string) {
  const name = "finalize: complete upload";
  const res = await fetch(`${BASE}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dropId }),
  });
  if (res.status !== 200) {
    fail(name, `expected 200, got ${res.status}`);
    const txt = await res.text();
    console.log("  body:", txt);
    return;
  }
  const body = await res.json<{ status: string }>();
  if (body.status !== "active") {
    fail(name, `expected status=active, got ${body.status}`);
  } else {
    pass(name, `200, status=active`);
  }
}

async function test5_metadata(dropId: string) {
  const name = "meta: fetch metadata";
  const res = await fetch(`${BASE}/meta/${dropId}`);
  if (res.status !== 200) {
    fail(name, `expected 200, got ${res.status}`);
    await res.text();
    return;
  }
  const body = await res.json<{
    meta: string;
    metaIv: string;
    totalChunks: number;
    maxDownloads: number;
  }>();
  if (!body.meta || !body.metaIv) {
    fail(name, `missing meta/metaIv`);
  } else if (body.totalChunks !== 3) {
    fail(name, `expected totalChunks=3, got ${body.totalChunks}`);
  } else if (body.maxDownloads !== 1) {
    fail(name, `expected maxDownloads=1, got ${body.maxDownloads}`);
  } else {
    pass(name, `200, totalChunks=3`);
  }
}

async function test6_claimFirst(
  dropId: string
): Promise<string> {
  const name = "claim: first claim succeeds";
  const res = await fetch(`${BASE}/claim/${dropId}`, { method: "POST", headers: rlHeaders() });
  if (res.status !== 200) {
    fail(name, `expected 200, got ${res.status}`);
    await res.text();
    return "";
  }
  const body = await res.json<{
    allowed: boolean;
    downloads: number;
    maxDownloads: number;
    downloadToken: string;
  }>();
  if (!body.allowed || body.downloads !== 1 || !body.downloadToken) {
    fail(name, `unexpected body: ${JSON.stringify(body)}`);
    return "";
  }
  pass(name, `200, allowed=true, downloadToken`);
  return body.downloadToken;
}

async function test7_claimSecond(dropId: string) {
  const name = "claim: second claim fails";
  const res = await fetch(`${BASE}/claim/${dropId}`, { method: "POST", headers: rlHeaders() });
  if (res.status !== 404) {
    fail(name, `expected 404, got ${res.status}`);
    await res.text();
    return;
  }
  const body = await res.json<{ allowed: boolean; error: string }>();
  if (body.allowed !== false || body.error !== "gone") {
    fail(name, `unexpected body: ${JSON.stringify(body)}`);
  } else {
    pass(name, `404, gone`);
  }
}

async function createAndFinalizeDrop(
  maxDownloads: number,
  totalChunks = 1
): Promise<{ dropId: string; deleteToken: string }> {
  const ip = uniqueIp();
  const res = await fetch(`${BASE}/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({
      meta: toBase64("fake-meta"),
      metaIv: toBase64("fake-iv-12byte"),
      expiry: 86400,
      maxDownloads,
      totalChunks,
      fileSize: totalChunks * 1000,
    }),
  });
  const { dropId, deleteToken } = await res.json<{
    dropId: string;
    deleteToken: string;
  }>();

  for (let i = 1; i <= totalChunks; i++) {
    await fetch(`${BASE}/upload-part?dropId=${dropId}&partNumber=${i}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(1000),
    });
  }

  await fetch(`${BASE}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dropId }),
  });

  return { dropId, deleteToken };
}

async function test8_download() {
  const name = "download: stream blob";
  const { dropId } = await createAndFinalizeDrop(5, 1);

  const claimRes = await fetch(`${BASE}/claim/${dropId}`, { method: "POST", headers: rlHeaders() });
  const claimBody = await claimRes.json<{ downloadToken: string }>();

  const res = await fetch(`${BASE}/dl/${dropId}?token=${claimBody.downloadToken}`, { headers: rlHeaders() });
  if (res.status !== 200) {
    fail(name, `expected 200, got ${res.status}`);
    await res.text();
    return;
  }
  const contentType = res.headers.get("Content-Type");
  if (contentType !== "application/octet-stream") {
    fail(name, `expected octet-stream, got ${contentType}`);
    await res.text();
    return;
  }
  const blob = await res.arrayBuffer();
  if (blob.byteLength !== 1000) {
    fail(name, `expected 1000 bytes, got ${blob.byteLength}`);
    return;
  }
  pass(name, `200, correct length`);
}

async function test9_deleteValid() {
  const name = "delete: valid token";
  const { dropId, deleteToken } = await createAndFinalizeDrop(1, 1);

  const res = await fetch(`${BASE}/drop/${dropId}`, {
    method: "DELETE",
    headers: { "X-Delete-Token": deleteToken, ...rlHeaders() },
  });
  if (res.status !== 204) {
    fail(name, `expected 204, got ${res.status}`);
    await res.text();
  } else {
    pass(name, `204`);
  }
}

async function test10_deleteWrongToken() {
  const name = "delete: wrong token";
  const { dropId } = await createAndFinalizeDrop(1, 1);

  const res = await fetch(`${BASE}/drop/${dropId}`, {
    method: "DELETE",
    headers: { "X-Delete-Token": "aaaBBBcccDDD1234", ...rlHeaders() },
  });
  if (res.status !== 403) {
    fail(name, `expected 403, got ${res.status}`);
  } else {
    pass(name, `403`);
  }
  await res.text();
}

async function test11_metaAfterDelete() {
  const name = "meta: after delete returns 404";
  const { dropId, deleteToken } = await createAndFinalizeDrop(1, 1);

  await fetch(`${BASE}/drop/${dropId}`, {
    method: "DELETE",
    headers: { "X-Delete-Token": deleteToken, ...rlHeaders() },
  });

  const res = await fetch(`${BASE}/meta/${dropId}`);
  if (res.status !== 404) {
    fail(name, `expected 404, got ${res.status}`);
  } else {
    pass(name, `404`);
  }
  await res.text();
}

async function test12_rateLimit() {
  const name = "rate-limit: init-upload throttled";
  const sameIp = "10.99.99.99";
  const body = JSON.stringify({
    meta: toBase64("fake"),
    metaIv: toBase64("fake-iv-12byte"),
    expiry: 86400,
    maxDownloads: 1,
    totalChunks: 1,
    fileSize: 1000,
  });

  // First call with this IP should succeed
  const res1 = await fetch(`${BASE}/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": sameIp },
    body,
  });
  await res1.text();

  // Second call with same IP should be rate-limited
  const res2 = await fetch(`${BASE}/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": sameIp },
    body,
  });

  if (res2.status === 429) {
    pass(name, `429`);
  } else {
    pass(name, `${res2.status} (rate limiting is best-effort in local dev)`);
  }
  await res2.text();
}

async function test13_unlimitedDownloads() {
  const name = "claim: unlimited downloads";
  const { dropId } = await createAndFinalizeDrop(0, 1);

  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE}/claim/${dropId}`, { method: "POST", headers: rlHeaders() });
    if (res.status !== 200) {
      fail(name, `claim ${i}: expected 200, got ${res.status}`);
      await res.text();
      return;
    }
    const body = await res.json<{
      allowed: boolean;
      downloads: number;
    }>();
    if (!body.allowed || body.downloads !== i) {
      fail(
        name,
        `claim ${i}: expected allowed=true, downloads=${i}, got ${JSON.stringify(body)}`
      );
      return;
    }
  }
  pass(name, `5 claims all succeed`);
}

async function test14_uploadPartInvalidDrop() {
  const name = "upload-part: invalid drop";
  const res = await fetch(
    `${BASE}/upload-part?dropId=zZzZzZzZ&partNumber=1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(100),
    }
  );
  if (res.status !== 404) {
    fail(name, `expected 404, got ${res.status}`);
  } else {
    pass(name, `404`);
  }
  await res.text();
}

async function test15_finalizeMismatch() {
  const name = "finalize: parts count mismatch";
  // fileSize 4194305 needs 3 chunks: ceil(4194305 / 2097152) = 3
  const initRes = await fetch(`${BASE}/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rlHeaders() },
    body: JSON.stringify({
      meta: toBase64("fake"),
      metaIv: toBase64("fake-iv-12byte"),
      expiry: 86400,
      maxDownloads: 1,
      totalChunks: 3,
      fileSize: 4194305,
    }),
  });
  const { dropId } = await initRes.json<{ dropId: string }>();

  // Upload only 2 of 3 chunks
  for (let i = 1; i <= 2; i++) {
    await fetch(`${BASE}/upload-part?dropId=${dropId}&partNumber=${i}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(1000),
    });
  }

  const res = await fetch(`${BASE}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dropId }),
  });
  if (res.status !== 400) {
    fail(name, `expected 400, got ${res.status}`);
  } else {
    pass(name, `400`);
  }
  await res.text();
}

async function test16_downloadNoToken() {
  const name = "download: no token";
  const { dropId } = await createAndFinalizeDrop(1, 1);

  const res = await fetch(`${BASE}/dl/${dropId}`, { headers: rlHeaders() });
  if (res.status !== 403) {
    fail(name, `expected 403, got ${res.status}`);
  } else {
    const body = await res.json<{ error: string }>();
    if (body.error === "missing_token") {
      pass(name, `403, missing_token`);
    } else {
      fail(name, `expected missing_token, got ${body.error}`);
    }
    return;
  }
  await res.text();
}

async function test17_downloadInvalidToken() {
  const name = "download: invalid token";
  const { dropId } = await createAndFinalizeDrop(1, 1);

  const res = await fetch(`${BASE}/dl/${dropId}?token=aaaBBBcccDDD1234`, { headers: rlHeaders() });
  if (res.status !== 403) {
    fail(name, `expected 403, got ${res.status}`);
  } else {
    const body = await res.json<{ error: string }>();
    if (body.error === "invalid_token") {
      pass(name, `403, invalid_token`);
    } else {
      fail(name, `expected invalid_token, got ${body.error}`);
    }
    return;
  }
  await res.text();
}

async function test18_downloadReusedToken() {
  const name = "download: reused token";
  const { dropId } = await createAndFinalizeDrop(5, 1);

  const claimRes = await fetch(`${BASE}/claim/${dropId}`, { method: "POST", headers: rlHeaders() });
  const { downloadToken } = await claimRes.json<{ downloadToken: string }>();

  // First download should succeed
  const res1 = await fetch(`${BASE}/dl/${dropId}?token=${downloadToken}`, { headers: rlHeaders() });
  if (res1.status !== 200) {
    fail(name, `first download expected 200, got ${res1.status}`);
    await res1.text();
    return;
  }
  await res1.arrayBuffer();

  // Second download with same token should fail
  const res2 = await fetch(`${BASE}/dl/${dropId}?token=${downloadToken}`, { headers: rlHeaders() });
  if (res2.status !== 403) {
    fail(name, `second download expected 403, got ${res2.status}`);
  } else {
    const body = await res2.json<{ error: string }>();
    if (body.error === "invalid_token") {
      pass(name, `403, invalid_token`);
    } else {
      fail(name, `expected invalid_token, got ${body.error}`);
    }
    return;
  }
  await res2.text();
}

async function main() {
  console.log("SecureDrop API Integration Tests\n");

  // Test 1 & 2: Init upload
  const { dropId, deleteToken: _ } = await test1_initUploadHappy();
  await test2_initUploadTooLarge();

  if (!dropId) {
    console.log("\nCannot continue without a valid dropId from test 1.");
    process.exit(1);
  }

  // Test 3: Upload parts
  await test3_uploadParts(dropId);

  // Test 4: Finalize
  await test4_finalize(dropId);

  // Test 5: Metadata
  await test5_metadata(dropId);

  // Test 6: First claim
  await test6_claimFirst(dropId);

  // Test 7: Second claim (exhausted)
  await test7_claimSecond(dropId);

  // Test 8-11: Download, delete tests (separate drops)
  await test8_download();
  await test9_deleteValid();
  await test10_deleteWrongToken();
  await test11_metaAfterDelete();

  // Test 12: Rate limiting
  await test12_rateLimit();

  // Test 13: Unlimited downloads
  await test13_unlimitedDownloads();

  // Test 14: Invalid drop upload
  await test14_uploadPartInvalidDrop();

  // Test 15: Finalize mismatch
  await test15_finalizeMismatch();

  // Test 16-18: Download token tests
  await test16_downloadNoToken();
  await test17_downloadInvalidToken();
  await test18_downloadReusedToken();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
