import type {
  InitUploadRequest,
  InitUploadResponse,
  FinalizeRequest,
  FinalizeResponse,
  MetaResponse,
  ClaimResponse,
} from "@shared/types";

class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(body.error ? String(body.error) : `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: Record<string, unknown>;
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export async function initUpload(
  req: InitUploadRequest
): Promise<InitUploadResponse> {
  const res = await fetch("/api/init-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleResponse<InitUploadResponse>(res);
}

export async function uploadPart(
  dropId: string,
  partNumber: number,
  body: Uint8Array
): Promise<{ partNumber: number }> {
  const res = await fetch(
    `/api/upload-part?dropId=${dropId}&partNumber=${partNumber}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body,
    }
  );
  return handleResponse<{ partNumber: number }>(res);
}

export async function finalize(
  req: FinalizeRequest
): Promise<FinalizeResponse> {
  const res = await fetch("/api/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return handleResponse<FinalizeResponse>(res);
}

export async function getMeta(dropId: string): Promise<MetaResponse> {
  const res = await fetch(`/api/meta/${dropId}`);
  return handleResponse<MetaResponse>(res);
}

export async function claim(dropId: string): Promise<ClaimResponse> {
  const res = await fetch(`/api/claim/${dropId}`, { method: "POST" });
  return handleResponse<ClaimResponse>(res);
}

export async function downloadBlob(
  dropId: string,
  token: string
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`/api/dl/${dropId}?token=${token}`);
  if (!res.ok) {
    let body: Record<string, unknown>;
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    throw new ApiError(res.status, body);
  }
  if (!res.body) {
    throw new Error("No response body");
  }
  return res.body;
}

export async function deleteDrop(
  dropId: string,
  deleteToken: string
): Promise<void> {
  const res = await fetch(`/api/drop/${dropId}`, {
    method: "DELETE",
    headers: { "X-Delete-Token": deleteToken },
  });
  if (!res.ok) {
    let body: Record<string, unknown>;
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    throw new ApiError(res.status, body);
  }
}

export { ApiError };
