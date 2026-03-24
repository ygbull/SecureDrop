import { EXPIRY_OPTIONS, DOWNLOAD_LIMIT_OPTIONS } from "@shared/constants";

interface OptionsProps {
  expiry: number;
  onExpiryChange: (value: number) => void;
  maxDownloads: number;
  onMaxDownloadsChange: (value: number) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  passwordEnabled: boolean;
  onPasswordToggle: (enabled: boolean) => void;
  disabled: boolean;
}

export default function Options({
  expiry,
  onExpiryChange,
  maxDownloads,
  onMaxDownloadsChange,
  password,
  onPasswordChange,
  passwordEnabled,
  onPasswordToggle,
  disabled,
}: OptionsProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="expiry-select" className="text-sm text-text-secondary font-medium">
          Expires after
        </label>
        <select
          id="expiry-select"
          value={expiry}
          onChange={(e) => onExpiryChange(Number(e.target.value))}
          disabled={disabled}
          className="appearance-none bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
        >
          {EXPIRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor="download-limit-select" className="text-sm text-text-secondary font-medium">
          Download limit
        </label>
        <select
          id="download-limit-select"
          value={maxDownloads}
          onChange={(e) => onMaxDownloadsChange(Number(e.target.value))}
          disabled={disabled}
          className="appearance-none bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
        >
          {DOWNLOAD_LIMIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-text-secondary font-medium">
            Password protection
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={passwordEnabled}
            aria-label="Toggle password protection"
            onClick={() => onPasswordToggle(!passwordEnabled)}
            disabled={disabled}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
              ${passwordEnabled ? "bg-accent" : "bg-border"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                ${passwordEnabled ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
        </div>

        {passwordEnabled && (
          <input
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Enter password"
            disabled={disabled}
            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent disabled:opacity-50"
          />
        )}
      </div>
    </div>
  );
}
