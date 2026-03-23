export interface InitUploadRequest {
  meta: string;
  metaIv: string;
  salt?: string;
  expiry: number;
  maxDownloads: number;
  totalChunks: number;
  fileSize: number;
}

export interface InitUploadResponse {
  dropId: string;
  deleteToken: string;
  expiresAt: string;
}

export interface UploadPartRequest {
  dropId: string;
  partNumber: number;
}

export interface UploadPartResponse {
  partNumber: number;
}

export interface FinalizeRequest {
  dropId: string;
}

export interface FinalizeResponse {
  status: "active";
}

export interface DropMetadata {
  meta: string;
  metaIv: string;
  salt: string | null;
  totalChunks: number;
  fileSize: number;
  expiry: number;
  maxDownloads: number;
  status: "pending" | "active";
  deleteToken: string;
  createdAt: string;
  expiresAt: string;
}

export interface ClaimResponse {
  allowed: boolean;
  downloads: number;
  maxDownloads: number;
  downloadToken: string;
  error?: "exhausted" | "gone";
}

export interface DecryptedMetadata {
  fileName: string;
  mimeType: string;
  fileSize: number;
  totalChunks: number;
}

export interface MetaResponse {
  meta: string;
  metaIv: string;
  salt: string | null;
  totalChunks: number;
  maxDownloads: number;
  expiry: number;
  createdAt: string;
}
