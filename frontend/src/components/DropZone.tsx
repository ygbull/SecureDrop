import { useState, useRef, useCallback } from "react";
import { MAX_FILE_SIZE } from "@shared/constants";
import { formatFileSize } from "../lib/utils";

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled: boolean;
}

export default function DropZone({ onFileSelected, disabled }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_FILE_SIZE) {
        setError(`File exceeds 100MB limit (${formatFileSize(file.size)})`);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      e.target.value = "";
    },
    [validateAndSelect]
  );

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed p-12
        transition-all duration-200 text-center
        bg-gradient-to-b from-[#151518] to-[#131316]
        shadow-[0_0_80px_20px_rgba(226,167,39,0.04)]
        ${isDragOver
          ? "border-accent bg-accent/5"
          : "border-border hover:border-border-hover"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-4">
        <svg
          className={`w-12 h-12 transition-colors duration-200 ${
            isDragOver ? "text-accent" : "text-text-tertiary"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        <div>
          <p className="text-text-primary font-medium">
            Drop a file here or click to browse
          </p>
          <p className="text-text-tertiary text-sm mt-1">
            Up to 100MB
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-error text-sm font-medium">{error}</p>
      )}
    </div>
  );
}
