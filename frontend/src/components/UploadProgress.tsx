interface UploadProgressProps {
  phase: "encrypting" | "uploading" | "finalizing" | "done";
  encryptProgress: number;
  uploadProgress: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
}

export default function UploadProgress({
  phase,
  encryptProgress,
  uploadProgress,
  currentChunk,
  totalChunks,
  error,
}: UploadProgressProps) {
  const progress = phase === "encrypting" ? encryptProgress : uploadProgress;

  const statusText = (() => {
    switch (phase) {
      case "encrypting":
        return `Encrypting chunk ${currentChunk} / ${totalChunks}`;
      case "uploading":
        return `Uploading chunk ${currentChunk} / ${totalChunks}`;
      case "finalizing":
        return "Finalizing...";
      case "done":
        return "Upload complete";
    }
  })();

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary font-medium">{statusText}</span>
        {phase !== "finalizing" && (
          <span className="text-text-tertiary font-mono text-xs">
            {progress}%
          </span>
        )}
      </div>

      {phase === "finalizing" ? (
        <div
          className="w-full h-2 bg-bg rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Finalizing upload"
        >
          <div className="h-full w-full animate-shimmer bg-accent/30 rounded-full" />
        </div>
      ) : (
        <div
          className="w-full h-2 bg-bg rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div
            className="h-full progress-fill rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-error/10 border border-error/20">
          <p className="text-error text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
