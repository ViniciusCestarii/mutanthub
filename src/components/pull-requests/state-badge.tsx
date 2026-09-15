import type { PullRequestState } from "@/generated/prisma/enums";
import { StatusPill } from "@/components/mutants/status-badge";

const TONE: Record<PullRequestState, "success" | "muted" | "info"> = {
  OPEN: "success",
  CLOSED: "muted",
  MERGED: "info",
};

const LABEL: Record<PullRequestState, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  MERGED: "Merged",
};

export function PullRequestStateBadge({ state }: { state: PullRequestState }) {
  return (
    <StatusPill tone={TONE[state]} data-testid="pull-request-state" data-state={state}>
      {LABEL[state]}
    </StatusPill>
  );
}
