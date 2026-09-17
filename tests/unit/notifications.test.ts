import { describe, expect, it } from "vitest";
import { type ActivityType } from "@/generated/prisma/enums";
import {
  buildNotifications,
  notificationRecipients,
  notificationTitle,
  type NotificationEvent,
  type Participants,
} from "@/domain/notifications/build";

const ALL_TYPES: ActivityType[] = [
  "MUTANT_SUBMITTED",
  "MUTANT_APPROVED",
  "MUTANT_REJECTED",
  "MUTANT_NEEDS_INFORMATION",
  "MUTANT_MARKED_DUPLICATE",
  "MUTANT_REPRODUCED",
  "MUTANT_KILLED",
  "MUTANT_MARKED_EQUIVALENT",
  "MUTANT_MARKED_INVALID",
  "MUTANT_STATUS_CHANGED",
  "COMMENT_ADDED",
  "MUTANT_EDITED",
  "MUTANT_WITHDRAWN",
  "MUTANT_RESUBMITTED",
  "KILL_CLAIMED",
  "KILL_VERIFIED",
  "KILL_REFUTED",
  "MUTANTS_IMPORTED",
  "MUTANT_DRIFTED",
];

const base: NotificationEvent = {
  type: "MUTANT_APPROVED",
  actorId: "reviewer",
  actorUsername: "bob",
  mutant: { id: 42, title: "Off by one", createdById: "submitter" },
  projectName: "bitcoin/bitcoin",
  detail: "Reproduced locally.",
};

const participants: Participants = {
  commenterIds: ["commenter", "submitter"],
  validatorIds: ["validator", "reviewer"],
  reviewerIds: ["reviewer", "maintainer"],
};

describe("notification recipients", () => {
  it("sends review outcomes to the submitter and everyone involved, never the actor", () => {
    expect(notificationRecipients(base, participants).sort()).toEqual([
      "commenter",
      "submitter",
      "validator",
    ]);
  });

  it("sends submissions, resubmissions, edits and withdrawals to reviewers", () => {
    for (const type of [
      "MUTANT_SUBMITTED",
      "MUTANT_RESUBMITTED",
      "MUTANT_EDITED",
      "MUTANT_WITHDRAWN",
    ] as const) {
      expect(
        notificationRecipients({ ...base, type, actorId: "submitter" }, participants).sort(),
      ).toEqual(["maintainer", "reviewer"]);
    }
  });

  it("does not notify the submitter about their own comment", () => {
    const own = { ...base, type: "COMMENT_ADDED" as const, actorId: "submitter" };
    // The reviewer is included because they recorded a reproduction on this mutant.
    expect(notificationRecipients(own, participants)).toEqual([
      "commenter",
      "validator",
      "reviewer",
    ]);
  });

  it("deduplicates recipients", () => {
    const dup = notificationRecipients(base, {
      commenterIds: ["x", "x"],
      validatorIds: ["x"],
      reviewerIds: [],
    });
    expect(dup).toEqual(["submitter", "x"]);
  });
});

describe("notification text", () => {
  it("describes the event with the actor and mutant id", () => {
    expect(notificationTitle(base)).toBe("@bob approved #42");
    expect(notificationTitle({ ...base, type: "MUTANT_NEEDS_INFORMATION" })).toBe(
      "@bob requested more information on #42",
    );
    expect(
      notificationTitle({ ...base, type: "MUTANT_REPRODUCED", detail: "COULD_NOT_REPRODUCE" }),
    ).toBe("@bob reproduced #42 as could not reproduce");
    expect(notificationTitle({ ...base, actorUsername: null, type: "COMMENT_ADDED" })).toBe(
      "Someone commented on #42",
    );
  });

  it("uses the mutant title plus a trimmed detail as the body", () => {
    const [draft] = buildNotifications(base, participants);
    expect(draft.body).toBe("Off by one — Reproduced locally.");
    const long = buildNotifications({ ...base, detail: "x".repeat(400) }, participants)[0];
    expect(long.body?.length).toBeLessThanOrEqual("Off by one — ".length + 200);
    expect(long.body?.endsWith("...")).toBe(true);
  });
});

// Added from the mutation-testing report: kills mutants that survived the original tests.
describe("notification titles", () => {
  const event = (type: ActivityType, detail: string | null = null): NotificationEvent => ({
    type,
    actorId: "u1",
    actorUsername: "alice",
    mutant: { id: 42, title: "Off by one", createdById: "u2" },
    projectName: "curl/curl",
    detail,
  });

  it("gives every event a distinct, specific title", () => {
    const titles = ALL_TYPES.map((t) => notificationTitle(event(t)));
    for (const t of titles) {
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toMatch(/updated #42$/); // the generic fallback is never used
    }
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("wires the detail into the events that carry one", () => {
    expect(notificationTitle(event("MUTANT_SUBMITTED"))).toBe("@alice submitted #42 in curl/curl");
    expect(notificationTitle(event("MUTANT_REPRODUCED", "COULD_NOT_REPRODUCE"))).toBe(
      "@alice reproduced #42 as could not reproduce",
    );
    expect(notificationTitle(event("MUTANTS_IMPORTED", "mull"))).toBe(
      "@alice imported mutants from mull",
    );
    expect(notificationTitle(event("MUTANTS_IMPORTED"))).toBe("@alice imported mutants");
    expect(notificationTitle(event("MUTANT_DRIFTED", "e8d1c4b"))).toBe(
      "The code of #42 changed on the default branch (e8d1c4b): was a test added?",
    );
    expect(notificationTitle(event("MUTANT_KILLED"))).toBe("#42 was marked as killed by @alice");
    expect(notificationTitle(event("MUTANT_WITHDRAWN"))).toBe("@alice withdrew #42");
    expect(notificationTitle({ ...event("COMMENT_ADDED"), actorUsername: null })).toBe(
      "Someone commented on #42",
    );
  });
});
