import { describe, it, expect } from "vitest";
import { validateUploadOptions } from "../upload";

describe("upload", () => {
  describe("validateUploadOptions", () => {
    it("returns null when file present, no password enabled", () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      expect(validateUploadOptions({ file, passwordEnabled: false, password: "" })).toBeNull();
    });

    it("returns null when file present and password provided", () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      expect(validateUploadOptions({ file, passwordEnabled: true, password: "secret" })).toBeNull();
    });

    it("returns error when no file selected", () => {
      expect(validateUploadOptions({ file: null, passwordEnabled: false, password: "" })).toBe(
        "No file selected"
      );
    });

    it("returns error when password enabled but empty", () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      expect(
        validateUploadOptions({ file, passwordEnabled: true, password: "" })
      ).toBe("Password is required when password protection is enabled");
    });

    it("returns error when password enabled but whitespace only", () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      expect(
        validateUploadOptions({ file, passwordEnabled: true, password: "   " })
      ).toBe("Password is required when password protection is enabled");
    });
  });
});
