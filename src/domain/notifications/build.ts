import type { ActivityType } from "@/generated/prisma/enums";

/**
 * Pure rules for turning an activity event into per-recipient notifications.
 * Kept free of database access so it can be unit-tested and reused by the seed.
 */

export interface NotificationEvent {
  type: ActivityType;
  actorId: string | null;
  actorUsername: string | null;
  mutant: { id: number; title: string; createdById: string };
  projectName: string;
  /** Free-text detail: review note, comment excerpt, reproduction result... */
  detail?: string | null;
}

export interface Participants {
  /** Users who commented on the mutant. */
  commenterIds: string[];
  /** Users who recorded a reproduction. */
  validatorIds: string[];
  /** Reviewers and maintainers of the project. */
  reviewerIds: string[];
}

export interface NotificationDraft {
  userId: string;
  title: string;
  body: string | null;
}

/** Events that concern the people moderating the project. */
const REVIEWER_EVENTS: ReadonlySet<ActivityType> = new Set([
  "MUTANT_SUBMITTED",
  "MUTANT_RESUBMITTED",
  "MUTANT_EDITED",
  "MUTANT_WITHDRAWN",
]);

function actorLabel(event: NotificationEvent): string {
  return event.actorUsername ? `@${event.actorUsername}` : "Someone";
}

export function notificationTitle(event: NotificationEvent): string {
  const actor = actorLabel(event);
  const ref = `#${event.mutant.id}`;
  switch (event.type) {
    case "MUTANT_SUBMITTED":
      return `${actor} submitted ${ref} in ${event.projectName}`;
    case "MUTANT_RESUBMITTED":
      return `${actor} resubmitted ${ref} for review`;
    case "MUTANT_EDITED":
      return `${actor} edited the submission of ${ref}`;
    case "MUTANT_WITHDRAWN":
      return `${actor} withdrew ${ref}`;
    case "MUTANT_APPROVED":
      return `${actor} approved ${ref}`;
    case "MUTANT_REJECTED":
      return `${actor} rejected ${ref}`;
    case "MUTANT_NEEDS_INFORMATION":
      return `${actor} requested more information on ${ref}`;
    case "MUTANT_MARKED_DUPLICATE":
      return `${actor} marked ${ref} as a duplicate`;
    case "MUTANT_REPRODUCED":
      return `${actor} reproduced ${ref}${event.detail ? ` as ${event.detail.replace(/_/g, " ").toLowerCase()}` : ""}`;
    case "MUTANT_KILLED":
      return `${ref} was marked as killed by ${actor}`;
    case "MUTANT_MARKED_EQUIVALENT":
      return `${ref} was classified as equivalent by ${actor}`;
    case "MUTANT_MARKED_INVALID":
      return `${ref} was classified as invalid by ${actor}`;
    case "MUTANT_STATUS_CHANGED":
      return `${actor} changed the outcome of ${ref}`;
    case "COMMENT_ADDED":
      return `${actor} commented on ${ref}`;
    case "MUTANTS_IMPORTED":
      return `${actor} imported mutants${event.detail ? ` from ${event.detail}` : ""}`;
    case "KILL_CLAIMED":
      return `${actor} reported a killing test for ${ref}${event.detail ? ` (${event.detail})` : ""}`;
    case "KILL_VERIFIED":
      return `A killing test for ${ref} was verified${event.detail ? ` (${event.detail})` : ""}`;
    case "KILL_REFUTED":
      return `A killing-test claim for ${ref} was refuted${event.detail ? ` (${event.detail})` : ""}`;
    default:
      return `${actor} updated ${ref}`;
  }
}

/**
 * Recipients: reviewer-facing events go to the project's reviewers and
 * maintainers; everything else goes to the submitter and to everyone who has
 * commented on or reproduced the mutant. The actor never notifies themself.
 */
export function notificationRecipients(event: NotificationEvent, p: Participants): string[] {
  const ids = REVIEWER_EVENTS.has(event.type)
    ? p.reviewerIds
    : [event.mutant.createdById, ...p.commenterIds, ...p.validatorIds];
  return [...new Set(ids)].filter((id) => id !== event.actorId);
}

export function buildNotifications(event: NotificationEvent, p: Participants): NotificationDraft[] {
  const title = notificationTitle(event);
  const body = notificationBody(event);
  return notificationRecipients(event, p).map((userId) => ({ userId, title, body }));
}

function notificationBody(event: NotificationEvent): string | null {
  const mutantTitle = event.mutant.title.trim();
  if (event.type === "MUTANT_REPRODUCED") return mutantTitle || null;
  if (event.type.startsWith("KILL_")) return mutantTitle || null;
  const detail = event.detail?.trim();
  if (!detail) return mutantTitle || null;
  const excerpt = detail.length > 200 ? `${detail.slice(0, 197)}...` : detail;
  return mutantTitle ? `${mutantTitle} — ${excerpt}` : excerpt;
}
