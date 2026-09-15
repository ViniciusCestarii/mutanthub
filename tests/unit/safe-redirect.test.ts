import { describe, expect, it } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";

describe("safeRelativePath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRelativePath("/mutants/1?x=1#L2", "/d")).toBe("/mutants/1?x=1#L2");
  });

  it("rejects open-redirect shapes", () => {
    const newline = String.fromCharCode(10);
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      `/ok${newline}Location: x`,
      "",
      undefined,
      null,
    ]) {
      expect(safeRelativePath(bad, "/d")).toBe("/d");
    }
  });
});
