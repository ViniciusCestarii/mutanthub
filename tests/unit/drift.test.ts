import { describe, expect, it } from "vitest";
import { classifyDrift, DRIFT_STATUS_LABEL, DRIFT_STATUSES } from "@/domain/drift/status";
import { locateOriginalCode } from "@/domain/kill-claims/applies";

describe("classifyDrift", () => {
  const file = ["int a;", "  if (x > 1)", "    return 1;", "int b;"].join("\n");

  it("maps lookups to applies, moved and gone", () => {
    expect(classifyDrift(locateOriginalCode(file, "if (x > 1)", 2))).toEqual({
      status: "APPLIES",
      line: 2,
    });
    expect(classifyDrift(locateOriginalCode(file, "if (x > 1)", 1))).toEqual({
      status: "MOVED",
      line: 2,
    });
    expect(classifyDrift(locateOriginalCode(file, "if (x >= 1)", 2))).toEqual({
      status: "GONE",
      line: null,
    });
  });

  it("has a label for every status", () => {
    for (const s of DRIFT_STATUSES) expect(DRIFT_STATUS_LABEL[s]).toBeTruthy();
  });
});
