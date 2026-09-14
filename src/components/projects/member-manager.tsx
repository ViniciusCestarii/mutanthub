"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import type { ProjectRole } from "@/generated/prisma/enums";
import {
  addMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
  type MemberResult,
} from "@/server/actions/project-actions";
import type { ActionResult } from "@/server/actions/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserChip } from "@/components/shared/user-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";

export interface MemberRow {
  userId: string;
  role: ProjectRole;
  user: { githubUsername: string; displayName: string; avatarUrl: string | null };
  isYou: boolean;
}

interface MemberManagerProps {
  projectId: string;
  owner: string;
  repo: string;
  members: MemberRow[];
  maintainers: number;
}

const ROLES: Array<{ value: ProjectRole; label: string; hint: string }> = [
  {
    value: "CONTRIBUTOR",
    label: "Contributor",
    hint: "Submits mutants, reproductions and comments.",
  },
  {
    value: "REVIEWER",
    label: "Reviewer",
    hint: "Moderates the review queue and classifies outcomes.",
  },
  {
    value: "MAINTAINER",
    label: "Maintainer",
    hint: "Reviewer plus member and project management.",
  },
];

type Result = ActionResult<MemberResult>;

function useMemberAction(
  action: (prev: Result | null, formData: FormData) => Promise<Result>,
  onSuccess: (result: Extract<Result, { ok: true }>) => void,
) {
  const router = useRouter();
  return useActionState(async (prev: Result | null, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      onSuccess(result);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    return result;
  }, null);
}

/** Member list with inline role changes and removal, plus an add-member form. */
export function MemberManager({
  projectId,
  owner,
  repo,
  members,
  maintainers,
}: MemberManagerProps) {
  const addFormRef = useRef<HTMLFormElement>(null);
  const [addState, addFormAction, addPending] = useMemberAction(addMemberAction, (r) => {
    toast.success(`@${r.data.username} added as ${r.data.role?.toLowerCase()}`);
    addFormRef.current?.reset();
  });
  const [, roleFormAction, rolePending] = useMemberAction(changeMemberRoleAction, (r) =>
    toast.success(`Role updated to ${r.data.role?.toLowerCase()}`),
  );
  const [, removeFormAction, removePending] = useMemberAction(removeMemberAction, () =>
    toast.success("Member removed"),
  );
  const addErrors = addState && !addState.ok ? (addState.fieldErrors ?? {}) : {};

  const hidden = (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="repo" value={repo} />
    </>
  );

  return (
    <div className="space-y-5" data-testid="member-manager">
      {members.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" compact />
      ) : (
        <div className="border-border overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-[11px] tracking-wide uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {members.map((m) => {
                const lastMaintainer = m.role === "MAINTAINER" && maintainers <= 1;
                return (
                  <tr key={m.userId} data-testid="member-row" data-username={m.user.githubUsername}>
                    <td className="px-3 py-2">
                      <UserChip user={m.user} size="sm" showName />
                      {m.isYou ? (
                        <span className="text-muted-foreground ml-2 text-[10px] uppercase">
                          you
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <form action={roleFormAction} className="inline-flex items-center gap-2">
                        {hidden}
                        <input type="hidden" name="userId" value={m.userId} />
                        <select
                          name="role"
                          defaultValue={m.role}
                          disabled={rolePending || lastMaintainer}
                          title={lastMaintainer ? "Promote another maintainer first" : undefined}
                          className="border-input bg-background h-7 rounded-md border px-2 text-xs"
                          data-testid="member-role"
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={removeFormAction} className="inline">
                        {hidden}
                        <input type="hidden" name="userId" value={m.userId} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground"
                          disabled={removePending || lastMaintainer}
                          title={
                            lastMaintainer ? "A project needs at least one maintainer" : "Remove"
                          }
                          data-testid="member-remove"
                        >
                          <UserMinus className="size-3.5" aria-hidden /> Remove
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form
        ref={addFormRef}
        action={addFormAction}
        className="space-y-3"
        data-testid="add-member-form"
      >
        {hidden}
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="member-username" className="text-xs">
              GitHub username
            </Label>
            <Input
              id="member-username"
              name="username"
              placeholder="octocat"
              autoComplete="off"
              required
              data-testid="add-member-username"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-role" className="text-xs">
              Role
            </Label>
            <select
              id="member-role"
              name="role"
              defaultValue="REVIEWER"
              className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
              data-testid="add-member-role"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" disabled={addPending} data-testid="add-member-submit">
            {addPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-3.5" aria-hidden />
            )}
            Add member
          </Button>
        </div>
        {addErrors.username ? (
          <p className="text-destructive text-xs">{addErrors.username}</p>
        ) : null}
        {addErrors.role ? <p className="text-destructive text-xs">{addErrors.role}</p> : null}
        <ul className="text-muted-foreground grid gap-1 text-[11px] sm:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r.value}>
              <span className="text-foreground font-medium">{r.label}:</span> {r.hint}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-[11px]">
          People who have not signed in yet get a placeholder account that is claimed automatically
          on their first GitHub sign-in.
        </p>
      </form>
    </div>
  );
}
