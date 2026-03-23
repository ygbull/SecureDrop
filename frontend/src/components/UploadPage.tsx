import { useState, useCallback } from "react";
import DropZone from "./DropZone";
import Options from "./Options";
import UploadProgress from "./UploadProgress";
import ShareLink from "./ShareLink";
import { handleUpload, type UploadProgress as UploadProgressState, type UploadResult } from "../lib/upload";
import { formatFileSize } from "../lib/utils";

type Phase = "idle" | "uploading" | "done" | "error";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState(86400);
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [password, setPassword] = useState("");
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<UploadProgressState>({
    phase: "encrypting",
    encryptProgress: 0,
    uploadProgress: 0,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
  });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelected = useCallback((f: File) => {
    setFile(f);
    setPhase("idle");
    setErrorMessage(null);
  }, []);

  const handleStartUpload = useCallback(async () => {
    if (!file) return;

    setPhase("uploading");
    setErrorMessage(null);

    try {
      const uploadResult = await handleUpload({
        file,
        expiry,
        maxDownloads,
        password: passwordEnabled ? password : "",
        onProgress: (state) => setProgress({ ...state }),
      });
      setResult(uploadResult);
      setPhase("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }, [file, expiry, maxDownloads, password, passwordEnabled]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPhase("idle");
    setResult(null);
    setErrorMessage(null);
    setProgress({
      phase: "encrypting",
      encryptProgress: 0,
      uploadProgress: 0,
      currentChunk: 0,
      totalChunks: 0,
      error: null,
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center animate-fadeInUp delay-0">
        <h1 className="text-xl font-semibold text-text-primary">SecureDrop</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Zero-knowledge encrypted file sharing
        </p>
      </div>

      {/* Done state */}
      {phase === "done" && result && (
        <div className="animate-fadeInUp">
          <ShareLink
            shareUrl={result.shareUrl}
            dropId={result.dropId}
            deleteToken={result.deleteToken}
            expiresAt={result.expiresAt}
            maxDownloads={maxDownloads}
          />
          <button
            onClick={handleReset}
            className="mt-4 w-full py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-all duration-200"
          >
            Send another file
          </button>
        </div>
      )}

      {/* Upload in progress */}
      {phase === "uploading" && (
        <div className="animate-fadeInUp">
          <UploadProgress
            phase={progress.phase}
            encryptProgress={progress.encryptProgress}
            uploadProgress={progress.uploadProgress}
            currentChunk={progress.currentChunk}
            totalChunks={progress.totalChunks}
            error={progress.error}
          />
        </div>
      )}

      {/* Idle / Error state */}
      {(phase === "idle" || phase === "error") && (
        <>
          <div className="animate-fadeInUp delay-1">
            <DropZone
              onFileSelected={handleFileSelected}
              disabled={false}
            />
          </div>

          {file && (
            <div className="animate-fadeInUp delay-2 rounded-xl border border-border bg-surface p-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-text-primary text-sm font-medium truncate">
                  {file.name}
                </p>
                <p className="text-text-tertiary text-xs">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="ml-3 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="animate-fadeInUp delay-2">
            <Options
              expiry={expiry}
              onExpiryChange={setExpiry}
              maxDownloads={maxDownloads}
              onMaxDownloadsChange={setMaxDownloads}
              password={password}
              onPasswordChange={setPassword}
              passwordEnabled={passwordEnabled}
              onPasswordToggle={setPasswordEnabled}
              disabled={false}
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20">
              <p className="text-error text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="animate-fadeInUp delay-3">
            <button
              onClick={handleStartUpload}
              disabled={!file}
              className={`
                w-full py-3 rounded-lg font-medium text-sm transition-all duration-200
                ${file
                  ? "bg-gradient-to-br from-[#e2a727] to-[#d4862a] text-bg hover:shadow-[0_0_20px_4px_rgba(226,167,39,0.2)] active:scale-[0.98]"
                  : "bg-surface border border-border text-text-tertiary cursor-not-allowed"
                }
              `}
            >
              Encrypt and Upload
            </button>
          </div>
        </>
      )}
    </div>
  );
}
