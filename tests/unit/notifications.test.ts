import { describe, expect, it } from "vitest";
import {
  buildNotifications,
  notificationRecipients,
  notificationTitle,
  type NotificationEvent,
  type Participants,
} from "@/domain/notifications/build";

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
