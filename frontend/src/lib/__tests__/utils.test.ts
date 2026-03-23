import { describe, it, expect } from "vitest";
import { toBase64Url, fromBase64Url, formatFileSize } from "../utils";

describe("utils", () => {
  // Test 1: base64url encode/decode round-trip
  it("base64url round-trip preserves bytes", () => {
    const input = crypto.getRandomValues(new Uint8Array(32));
    const encoded = toBase64Url(input);
    const decoded = fromBase64Url(encoded);

    expect(decoded).toEqual(input);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  // Test 2: base64url encode -- URL-safe characters
  it("base64url uses only URL-safe characters", () => {
    const input = new Uint8Array([255, 254, 253, 252]);
    const encoded = toBase64Url(input);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  // Test 3: base64url decode -- handles missing padding
  it("base64url decode handles missing padding", () => {
    const input = crypto.getRandomValues(new Uint8Array(31));
    const encoded = toBase64Url(input);

    expect(() => fromBase64Url(encoded)).not.toThrow();
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(input);
  });

  // Test 4: formatFileSize
  it("formats file sizes correctly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(10485760)).toBe("10.0 MB");
    expect(formatFileSize(104857600)).toBe("100.0 MB");
  });

  // Test 5: 40-byte wrapped key round-trip
  it("base64url round-trip works for 40-byte wrapped key", () => {
    const input = crypto.getRandomValues(new Uint8Array(40));
    const encoded = toBase64Url(input);
    const decoded = fromBase64Url(encoded);

    expect(decoded).toEqual(input);
    expect(encoded.length).toBe(54);
  });
});
