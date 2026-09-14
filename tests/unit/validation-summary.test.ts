import { describe, expect, it } from "vitest";
import { summarizeValidations } from "@/domain/mutants/validation-summary";

const DASH = "—";

describe("summarizeValidations", () => {
  it("reports no reproductions", () => {
    expect(summarizeValidations([])).toMatchObject({
      consensus: "NONE",
      label: "Not reproduced yet",
      total: 0,
    });
  });

  it("confirms survival when everyone agrees", () => {
    const s = summarizeValidations(["SURVIVED", "SURVIVED", "SURVIVED", "SURVIVED"]);
    expect(s.consensus).toBe("SURVIVED");
    expect(s.label).toBe(`Survived ${DASH} confirmed by 4 contributors`);
  });

  it("uses singular wording for one contributor", () => {
    expect(summarizeValidations(["KILLED"]).label).toBe(`Killed ${DASH} reported by 1 contributor`);
  });

  it("flags conflicts when survived and killed both appear", () => {
    const s = summarizeValidations(["SURVIVED", "KILLED", "COULD_NOT_REPRODUCE"]);
    expect(s.consensus).toBe("CONFLICTING");
    expect(s.label).toBe("Conflicting results");
    expect(s).toMatchObject({ survived: 1, killed: 1, couldNotReproduce: 1, total: 3 });
  });

  it("mentions failed reproductions alongside a consensus", () => {
    const s = summarizeValidations(["SURVIVED", "COULD_NOT_REPRODUCE"]);
    expect(s.consensus).toBe("SURVIVED");
    expect(s.label).toContain("1 could not reproduce");
  });

  it("handles only failed reproductions", () => {
    expect(summarizeValidations(["COULD_NOT_REPRODUCE"]).consensus).toBe("COULD_NOT_REPRODUCE");
  });
});
