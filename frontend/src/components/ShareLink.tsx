import { useState, useCallback } from "react";
import QRCode from "qrcode";
import { deleteDrop } from "../lib/api";
import { formatTimeRemaining } from "../lib/utils";

interface ShareLinkProps {
  shareUrl: string;
  dropId: string;
  deleteToken: string;
  expiresAt: string;
  maxDownloads: number;
}

export default function ShareLink({
  shareUrl,
  dropId,
  deleteToken,
  expiresAt,
  maxDownloads,
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setCopyFlash(true);
    setTimeout(() => setCopied(false), 2000);
    setTimeout(() => setCopyFlash(false), 600);
  }, [shareUrl]);

  const handleQr = useCallback(async () => {
    if (!qrDataUrl) {
      const url = await QRCode.toDataURL(shareUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#ffffff", light: "#131316" },
      });
      setQrDataUrl(url);
    }
    setShowQr((prev) => !prev);
  }, [shareUrl, qrDataUrl]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteDrop(dropId, deleteToken);
      setDeleted(true);
    } catch {
      setDeleting(false);
    }
  }, [dropId, deleteToken]);

  if (deleted) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center animate-fadeInUp">
        <p className="text-text-primary font-medium">Drop deleted</p>
        <p className="text-text-secondary text-sm mt-1">
          The file has been permanently destroyed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-b from-[#151518] to-[#131316] p-6 space-y-5 shadow-[0_0_80px_20px_rgba(226,167,39,0.04)]">
      {/* Checkmark */}
      <div className="flex justify-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle
            cx="24"
            cy="24"
            r="21"
            stroke="#22c55e"
            strokeWidth="2"
            strokeDasharray="132"
            strokeDashoffset="132"
            className="animate-drawCircle"
            fill="none"
          />
          <path
            d="M15 24.5L21 30.5L33 18.5"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="30"
            strokeDashoffset="30"
            className="animate-drawCheck"
            fill="none"
          />
        </svg>
      </div>

      {/* Link display */}
      <div className="bg-bg rounded-lg p-3 font-mono text-xs text-accent break-all select-all border border-border">
        {shareUrl}
      </div>

      {/* Copy & QR buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className={`
            flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200
            bg-gradient-to-br from-[#e2a727] to-[#d4862a] text-bg
            hover:shadow-[0_0_20px_4px_rgba(226,167,39,0.2)] active:scale-[0.98]
            ${copyFlash ? "animate-copyFlash" : ""}
          `}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <button
          onClick={handleQr}
          className="py-2.5 px-4 rounded-lg font-medium text-sm border border-border text-text-secondary hover:text-text-primary hover:border-border-hover transition-all duration-200"
        >
          QR
        </button>
      </div>

      {/* QR Code */}
      {showQr && qrDataUrl && (
        <div className="flex justify-center animate-fadeInUp">
          <img
            src={qrDataUrl}
            alt="QR code for share link"
            className="rounded-lg"
            width={200}
            height={200}
          />
        </div>
      )}

      {/* Info */}
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>{formatTimeRemaining(expiresAt)}</span>
        <span>
          {maxDownloads === 0
            ? "Unlimited downloads"
            : `${maxDownloads} download${maxDownloads !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-full py-2 rounded-lg text-sm font-medium text-error/70 hover:text-error hover:bg-error/5 border border-transparent hover:border-error/20 transition-all duration-200 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete Now"}
      </button>
    </div>
  );
}
