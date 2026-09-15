import { ScrollText } from "lucide-react";
import type { AuditEntry } from "@/server/repositories/audit-repository";
import { EmptyState } from "@/components/shared/empty-state";
import { UserChip } from "@/components/shared/user-chip";
import { absoluteDateTime } from "@/lib/format";

const LABEL: Record<AuditEntry["action"], string> = {
  MEMBER_ADDED: "added a member",
  MEMBER_ROLE_CHANGED: "changed a member's role",
  MEMBER_REMOVED: "removed a member",
  PROJECT_ACTIVATED: "reactivated the project",
  PROJECT_DEACTIVATED: "deactivated the project",
  PROJECT_REFRESHED: "refreshed metadata from GitHub",
  PROJECT_REGISTERED: "registered the project",
  MUTANT_REVIEWED: "reviewed a mutant",
  MUTANT_CLASSIFIED: "classified a mutant",
};

function details(entry: AuditEntry): string {
  const m = (entry.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof m.username === "string") parts.push(`@${m.username}`);
  if (typeof m.role === "string") parts.push(m.role.toLowerCase());
  if (typeof m.from === "string" && typeof m.to === "string") parts.push(`${m.from} → ${m.to}`);
  if (entry.targetType === "mutant") parts.push(`#${entry.targetId}`);
  return parts.join(" · ");
}

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={ScrollText} title="No privileged actions recorded yet" compact />;
  }
  return (
    <ol className="space-y-2 text-xs" data-testid="audit-trail">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
          data-action={e.action}
        >
          {e.actor ? <UserChip user={e.actor} size="xs" /> : <span>System</span>}
          <span>{LABEL[e.action]}</span>
          {details(e) ? (
            <span className="text-muted-foreground font-mono">{details(e)}</span>
          ) : null}
          <time dateTime={e.createdAt.toISOString()} className="text-muted-foreground">
            {absoluteDateTime(e.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
