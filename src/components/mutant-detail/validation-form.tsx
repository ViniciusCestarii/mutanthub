"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FlaskConical, Loader2 } from "lucide-react";
import type { ValidationResult } from "@/generated/prisma/enums";
import { VALIDATION_RESULTS, VALIDATION_RESULT_LABEL } from "@/domain/mutants/status";
import { addValidationAction } from "@/server/actions/mutant-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface ClaimOption {
  id: string;
  label: string;
  commitSha: string | null;
}

interface ValidationFormProps {
  mutantId: number;
  signedIn: boolean;
  /** Open kill claims this reproduction can verify. */
  claims?: ClaimOption[];
}

const RESULT_CLASS: Record<ValidationResult, string> = {
  SURVIVED: "data-[checked=true]:border-amber-500 data-[checked=true]:bg-amber-500/10",
  KILLED: "data-[checked=true]:border-emerald-500 data-[checked=true]:bg-emerald-500/10",
  COULD_NOT_REPRODUCE: "data-[checked=true]:border-foreground/40 data-[checked=true]:bg-muted",
};

export function ValidationForm({ mutantId, signedIn, claims = [] }: ValidationFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ValidationResult>("SURVIVED");
  const [claimId, setClaimId] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof addValidationAction>> | null, formData: FormData) => {
      const result = await addValidationAction(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
        toast.success("Reproduction recorded. Thank you for verifying.");
        router.refresh();
      }
      return result;
    },
    null,
  );

  if (!signedIn) {
    return (
      <div className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-3 text-xs">
        <Link
          href={routes.signIn(routes.mutant(mutantId))}
          className="text-foreground font-medium underline underline-offset-2"
        >
          Sign in
        </Link>{" "}
        to record a reproduction attempt.
      </div>
    );
  }

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : undefined;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
        data-testid="validation-open"
      >
        <FlaskConical className="size-3.5" aria-hidden /> Record a reproduction
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3" data-testid="validation-form">
      <input type="hidden" name="mutantId" value={mutantId} />
      {claims.length > 0 ? (
        <div className="space-y-1">
          <Label htmlFor={`val-claim-${mutantId}`} className="text-xs">
            Verifies a killing-test claim
          </Label>
          <select
            id={`val-claim-${mutantId}`}
            name="killClaimId"
            value={claimId}
            onChange={(e) => {
              setClaimId(e.target.value);
              const chosen = claims.find((c) => c.id === e.target.value);
              setCommitSha(chosen?.commitSha ?? "");
            }}
            className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
            data-testid="validation-claim"
          >
            <option value="">No, this reproduces the original submission</option>
            {claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-[11px]">
            Run the mutant at the claim&apos;s commit: a killed result verifies the claim, a
            survived result refutes it.
          </p>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={`val-commit-${mutantId}`} className="text-xs">
          Commit tested (optional)
        </Label>
        <Input
          id={`val-commit-${mutantId}`}
          name="commitSha"
          value={commitSha}
          onChange={(e) => setCommitSha(e.target.value)}
          placeholder="Leave empty for the mutant's own revision"
          className="font-mono text-xs"
          data-testid="validation-commit"
        />
        {errors.commitSha ? <p className="text-destructive text-xs">{errors.commitSha}</p> : null}
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium">Observed result</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {VALIDATION_RESULTS.map((value) => (
            <label
              key={value}
              data-checked={result === value}
              className={cn(
                "border-border hover:bg-muted flex cursor-pointer items-center justify-center rounded-md border px-2 py-1.5 text-center text-xs transition-colors",
                RESULT_CLASS[value],
              )}
            >
              <input
                type="radio"
                name="result"
                value={value}
                checked={result === value}
                onChange={() => setResult(value)}
                className="sr-only"
                data-testid={`validation-result-${value}`}
              />
              {VALIDATION_RESULT_LABEL[value]}
            </label>
          ))}
        </div>
        {errors.result ? <p className="text-destructive text-xs">{errors.result}</p> : null}
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor={`val-command-${mutantId}`} className="text-xs">
          Command used
        </Label>
        <Textarea
          id={`val-command-${mutantId}`}
          name="command"
          rows={2}
          placeholder="git apply mutant.patch && ctest --test-dir build"
          className="font-mono text-xs"
          data-testid="validation-command"
        />
        {errors.command ? <p className="text-destructive text-xs">{errors.command}</p> : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`val-env-${mutantId}`} className="text-xs">
          Environment
        </Label>
        <Textarea
          id={`val-env-${mutantId}`}
          name="environment"
          rows={2}
          placeholder="OS, compiler, toolchain versions"
          className="text-xs"
          data-testid="validation-environment"
        />
        {errors.environment ? (
          <p className="text-destructive text-xs">{errors.environment}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`val-killing-${mutantId}`} className="text-xs">
          Killing test {result === "KILLED" ? "" : "(if any)"}
        </Label>
        <Input
          id={`val-killing-${mutantId}`}
          name="killingTestRef"
          placeholder="Test path, upstream PR or commit URL that kills this mutant"
          className="text-xs"
          data-testid="validation-killing-test"
        />
        {result === "KILLED" && !errors.killingTestRef ? (
          <p className="text-muted-foreground text-[11px]">
            Linking the test lets reviewers classify the mutant as killed with evidence.
          </p>
        ) : null}
        {errors.killingTestRef ? (
          <p className="text-destructive text-xs">{errors.killingTestRef}</p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`val-notes-${mutantId}`} className="text-xs">
          Notes
        </Label>
        <Textarea
          id={`val-notes-${mutantId}`}
          name="notes"
          rows={2}
          placeholder="Anything unusual? Failing tests, flaky behaviour, build issues..."
          className="text-xs"
          data-testid="validation-notes"
        />
        {errors.notes ? <p className="text-destructive text-xs">{errors.notes}</p> : null}
      </div>
      {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      <p className="text-muted-foreground text-[11px]">
        Commands are stored as text and never executed by MutantHub.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending} data-testid="validation-submit">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Save reproduction
        </Button>
      </div>
    </form>
  );
}
