import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router";
import BurnNotice from "./BurnNotice";
import { fetchMetadata, prepareKey, unlockWithPassword, decryptAndDownload, triggerDownload } from "../lib/download";
import { formatFileSize } from "../lib/utils";
import type { MetaResponse, DecryptedMetadata } from "@shared/types";
import { ApiError } from "../lib/api";
import { decryptMetadata } from "../lib/crypto";

type Phase = "loading" | "password" | "ready" | "downloading" | "done" | "burned" | "error";

export default function DownloadPage() {
  const { id: dropId } = useParams<{ id: string }>();
  const keyRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [metaResponse, setMetaResponse] = useState<MetaResponse | null>(null);
  const [metadata, setMetadata] = useState<DecryptedMetadata | null>(null);
  const [fileKey, setFileKey] = useState<CryptoKey | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Strip fragment immediately on mount
  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    history.replaceState(null, "", window.location.pathname);

    if (!fragment) {
      setError("Missing decryption key in URL");
      setPhase("error");
      return;
    }

    keyRef.current = fragment;

    if (!dropId) {
      setPhase("burned");
      return;
    }

    (async () => {
      try {
        const meta = await fetchMetadata(dropId);
        setMetaResponse(meta);

        const { fileKey: key, needsPassword } = await prepareKey(fragment, meta);
        if (needsPassword) {
          setPhase("password");
        } else {
          setFileKey(key);
          const decrypted = await decryptMetadata(key, meta.meta, meta.metaIv);
          setMetadata(decrypted);
          setPhase("ready");
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
          setPhase("burned");
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setPhase("error");
        }
      }
    })();
  }, [dropId]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!keyRef.current || !metaResponse?.salt || !dropId) return;
    setPasswordError(null);

    try {
      const key = await unlockWithPassword(keyRef.current, password, metaResponse.salt);
      setFileKey(key);
      const { decryptMetadata } = await import("../lib/crypto");
      const decrypted = await decryptMetadata(key, metaResponse.meta, metaResponse.metaIv);
      setMetadata(decrypted);
      setPhase("ready");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Wrong password");
    }
  }, [password, metaResponse, dropId]);

  const handleDownload = useCallback(async () => {
    if (!fileKey || !metaResponse || !dropId) return;

    setPhase("downloading");
    try {
      const { blob, metadata: meta } = await decryptAndDownload(
        dropId,
        fileKey,
        metaResponse,
        (current, total) => setProgress({ current, total })
      );
      triggerDownload(blob, meta.fileName);
      setPhase("done");
    } catch (err) {
      if (err instanceof Error && (err.message === "exhausted" || err.message === "gone")) {
        setPhase("burned");
      } else if (err instanceof ApiError && (err.status === 410)) {
        setPhase("burned");
      } else {
        setError(err instanceof Error ? err.message : "Download failed");
        setPhase("error");
      }
    }
  }, [fileKey, metaResponse, dropId]);

  if (phase === "burned") return <BurnNotice />;

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-semibold text-text-primary">SecureDrop</h1>
        <p className="text-sm text-text-tertiary mt-1">
          End-to-end encrypted file
        </p>
      </div>

      {/* Loading */}
      {phase === "loading" && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-text-secondary">Loading...</p>
        </div>
      )}

      {/* Password prompt */}
      {phase === "password" && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <div className="flex justify-center">
            <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-center text-text-secondary text-sm">
            This file is password protected.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            placeholder="Enter password"
            aria-label="Password for encrypted file"
            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            autoFocus
          />
          {passwordError && (
            <p className="text-error text-sm">{passwordError}</p>
          )}
          <button
            onClick={handlePasswordSubmit}
            className="w-full py-2.5 rounded-lg font-medium text-sm bg-gradient-to-br from-[#e2a727] to-[#d4862a] text-bg hover:shadow-[0_0_20px_4px_rgba(226,167,39,0.2)] active:scale-[0.98] transition-all duration-200"
          >
            Unlock
          </button>
        </div>
      )}

      {/* Ready to download */}
      {phase === "ready" && metadata && (
        <div className="rounded-xl border border-border bg-gradient-to-b from-[#151518] to-[#131316] p-6 space-y-5 shadow-[0_0_80px_20px_rgba(226,167,39,0.04)]">
          <div className="space-y-1">
            <p className="text-text-primary font-medium truncate">
              {metadata.fileName}
            </p>
            <p className="text-text-tertiary text-sm">
              {formatFileSize(metadata.fileSize)}
            </p>
          </div>

          <button
            onClick={handleDownload}
            className="w-full py-3 rounded-lg font-medium text-sm bg-gradient-to-br from-[#e2a727] to-[#d4862a] text-bg hover:shadow-[0_0_20px_4px_rgba(226,167,39,0.2)] active:scale-[0.98] transition-all duration-200"
          >
            Decrypt and Download
          </button>

          <p className="text-text-tertiary text-xs text-center">
            On a shared device? Use a private/incognito window.
          </p>
        </div>
      )}

      {/* Downloading */}
      {phase === "downloading" && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <p className="text-text-secondary text-sm font-medium">
            Decrypting chunk {progress.current} / {progress.total}
          </p>
          <div
            className="w-full h-2 bg-bg rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Download and decrypt progress"
          >
            <div
              className="h-full progress-fill rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center animate-fadeInUp">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-4">
            <circle cx="24" cy="24" r="21" stroke="#22c55e" strokeWidth="2" strokeDasharray="132" strokeDashoffset="132" className="animate-drawCircle" fill="none" />
            <path d="M15 24.5L21 30.5L33 18.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset="30" className="animate-drawCheck" fill="none" />
          </svg>
          <p className="text-text-primary font-medium">Download complete</p>
          <p className="text-text-tertiary text-sm mt-1">
            Your file has been decrypted and saved.
          </p>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-6 text-center">
          <p className="text-error font-medium">Something went wrong</p>
          <p className="text-text-secondary text-sm mt-2">
            {error || "An unexpected error occurred."}
          </p>
          <a
            href="/"
            className="inline-block mt-4 py-2 px-4 rounded-lg text-sm border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-all duration-200"
          >
            Go Home
          </a>
        </div>
      )}
    </div>
  );
}
