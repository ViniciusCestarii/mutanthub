"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";
import { createKillClaimAction } from "@/server/actions/kill-claim-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** "PR #123 / commit / test path kills this mutant" form. */
export function KillClaimForm({ mutantId }: { mutantId: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createKillClaimAction>> | null, formData: FormData) => {
      const result = await createKillClaimAction(prev, formData);
      if (result.ok) {
        toast.success("Killing test reported");
        formRef.current?.reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-2" data-testid="kill-claim-form">
      <input type="hidden" name="mutantId" value={mutantId} />
      <Label htmlFor={`claim-ref-${mutantId}`} className="text-xs">
        Report a killing test
      </Label>
      <div className="flex gap-2">
        <Input
          id={`claim-ref-${mutantId}`}
          name="reference"
          placeholder="#123, a PR or commit URL, a commit SHA, or tests/unit/unit1300.c"
          className="font-mono text-xs"
          required
          data-testid="kill-claim-reference"
        />
        <Button type="submit" size="sm" disabled={pending} data-testid="kill-claim-submit">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Target className="size-3.5" aria-hidden />
          )}
          Report
        </Button>
      </div>
      {errors.reference ? <p className="text-destructive text-xs">{errors.reference}</p> : null}
      <Textarea
        name="note"
        rows={2}
        placeholder="Optional: which test, and why it detects the mutation"
        className="text-xs"
        data-testid="kill-claim-note"
      />
      {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      <p className="text-muted-foreground text-[11px]">
        The claim is checked against GitHub (pull request state, merge commit, whether the original
        code is still there). It becomes verified through reproductions at that commit or a
        reviewer&apos;s verdict; only then does the mutant count as killed.
      </p>
    </form>
  );
}
