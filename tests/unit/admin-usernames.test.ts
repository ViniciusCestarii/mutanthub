import { describe, expect, it } from "vitest";
import { isBootstrapAdmin, parseAdminUsernames } from "@/lib/admin-usernames";

describe("ADMIN_GITHUB_USERNAMES", () => {
  it("parses comma or whitespace separated names, ignoring @ and case", () => {
    expect([...parseAdminUsernames(" @BrunoErg, alice  bob,, ")]).toEqual([
      "brunoerg",
      "alice",
      "bob",
    ]);
    expect(parseAdminUsernames(undefined).size).toBe(0);
    expect(parseAdminUsernames("!!!, ***").size).toBe(0);
  });

  it("matches usernames case-insensitively", () => {
    expect(isBootstrapAdmin("brunoerg", "BrunoErg")).toBe(true);
    expect(isBootstrapAdmin("someone", "brunoerg")).toBe(false);
    expect(isBootstrapAdmin("brunoerg", undefined)).toBe(false);
  });
});
