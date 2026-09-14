"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Wand2 } from "lucide-react";
import type { MutationOperator, ObservedResult } from "@/generated/prisma/enums";
import { MUTATION_OPERATORS } from "@/domain/mutants/operators";
import { generateUnifiedDiff } from "@/domain/mutants/diff";
import { editMutantAction, type EditMutantResult } from "@/server/actions/mutant-actions";
import type { ActionResult } from "@/server/actions/result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonacoDiff } from "@/components/code/monaco-diff";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface EditMutantFormValues {
  mutantId: number;
  filePath: string;
  startLine: number;
  language: string;
  title: string;
  mutationOperator: MutationOperator;
  originalCode: string;
  mutatedCode: string;
  gitDiff: string;
  description: string;
  buildCommand: string;
  testCommand: string;
  fuzzCommand: string;
  testDurationSeconds: number | null;
  environmentDescription: string;
  operatingSystem: string;
  compiler: string;
  observedResult: ObservedResult;
  notes: string;
  stdout: string;
  stderr: string;
}

const OBSERVED: Array<{ value: ObservedResult; label: string }> = [
  { value: "SURVIVED", label: "Survived" },
  { value: "KILLED", label: "Killed" },
  { value: "UNKNOWN", label: "Unknown" },
];

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && !error ? <p className="text-muted-foreground text-[11px]">{hint}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

/** Edit form for an existing submission. The location is shown but immutable. */
export function EditMutantForm({ initial }: { initial: EditMutantFormValues }) {
  const router = useRouter();
  const [originalCode, setOriginalCode] = useState(initial.originalCode);
  const [mutatedCode, setMutatedCode] = useState(initial.mutatedCode);
  const [gitDiff, setGitDiff] = useState(initial.gitDiff);
  const [observed, setObserved] = useState<ObservedResult>(initial.observedResult);

  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult<EditMutantResult> | null, formData: FormData) => {
      const result = await editMutantAction(prev, formData);
      if (result.ok) {
        toast.success(
          result.data.changedFields.length
            ? `Submission updated (${result.data.changedFields.length} field${result.data.changedFields.length === 1 ? "" : "s"})`
            : "Submission saved without changes",
        );
        router.push(routes.mutant(result.data.mutantId));
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
    <form action={formAction} className="space-y-6" data-testid="edit-mutant-form">
      <input type="hidden" name="mutantId" value={initial.mutantId} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Mutation</h2>
        <Field label="Title" htmlFor="edit-title" error={errors.title}>
          <Input
            id="edit-title"
            name="title"
            defaultValue={initial.title}
            maxLength={140}
            data-testid="edit-title"
          />
        </Field>
        <Field label="Mutation operator" htmlFor="edit-operator" error={errors.mutationOperator}>
          <select
            id="edit-operator"
            name="mutationOperator"
            defaultValue={initial.mutationOperator}
            className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
            data-testid="edit-operator"
          >
            {MUTATION_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Original code" htmlFor="edit-original" error={errors.originalCode}>
            <Textarea
              id="edit-original"
              name="originalCode"
              rows={5}
              value={originalCode}
              onChange={(e) => setOriginalCode(e.target.value)}
              className="font-mono text-xs"
              data-testid="edit-original"
            />
          </Field>
          <Field label="Mutated code" htmlFor="edit-mutated" error={errors.mutatedCode}>
            <Textarea
              id="edit-mutated"
              name="mutatedCode"
              rows={5}
              value={mutatedCode}
              onChange={(e) => setMutatedCode(e.target.value)}
              className="font-mono text-xs"
              data-testid="edit-mutated"
            />
          </Field>
        </div>
        {originalCode.trim() && mutatedCode.trim() ? (
          <MonacoDiff
            original={originalCode}
            modified={mutatedCode}
            language={initial.language}
            height={180}
            className="border-border overflow-hidden rounded-md border"
          />
        ) : null}
        <Field
          label="Git diff"
          htmlFor="edit-diff"
          error={errors.gitDiff}
          hint="Leave empty to generate a minimal patch from the code above."
        >
          <div className="space-y-1.5">
            <Textarea
              id="edit-diff"
              name="gitDiff"
              rows={8}
              value={gitDiff}
              onChange={(e) => setGitDiff(e.target.value)}
              className="font-mono text-xs"
              data-testid="edit-diff"
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() =>
                setGitDiff(
                  generateUnifiedDiff({
                    filePath: initial.filePath,
                    startLine: initial.startLine,
                    originalCode,
                    mutatedCode,
                  }),
                )
              }
            >
              <Wand2 className="size-3" aria-hidden /> Generate from code
            </Button>
          </div>
        </Field>
        <Field
          label="Description (optional, Markdown)"
          htmlFor="edit-description"
          error={errors.description}
        >
          <Textarea
            id="edit-description"
            name="description"
            rows={3}
            defaultValue={initial.description}
            className="text-xs"
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">How did you test it?</h2>
        <Field label="Build command" htmlFor="edit-build" error={errors.buildCommand}>
          <Textarea
            id="edit-build"
            name="buildCommand"
            rows={2}
            defaultValue={initial.buildCommand}
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Test command" htmlFor="edit-test" error={errors.testCommand}>
          <Textarea
            id="edit-test"
            name="testCommand"
            rows={2}
            defaultValue={initial.testCommand}
            className="font-mono text-xs"
            data-testid="edit-test-command"
          />
        </Field>
        <Field label="Fuzz command (optional)" htmlFor="edit-fuzz" error={errors.fuzzCommand}>
          <Textarea
            id="edit-fuzz"
            name="fuzzCommand"
            rows={2}
            defaultValue={initial.fuzzCommand}
            className="font-mono text-xs"
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field
            label="Execution duration (seconds)"
            htmlFor="edit-duration"
            error={errors.testDurationSeconds}
          >
            <Input
              id="edit-duration"
              name="testDurationSeconds"
              type="number"
              min={0}
              defaultValue={initial.testDurationSeconds ?? ""}
            />
          </Field>
          <Field label="Operating system" htmlFor="edit-os" error={errors.operatingSystem}>
            <Input id="edit-os" name="operatingSystem" defaultValue={initial.operatingSystem} />
          </Field>
          <Field label="Compiler" htmlFor="edit-compiler" error={errors.compiler}>
            <Input id="edit-compiler" name="compiler" defaultValue={initial.compiler} />
          </Field>
        </div>
        <Field label="Environment" htmlFor="edit-env" error={errors.environmentDescription}>
          <Textarea
            id="edit-env"
            name="environmentDescription"
            rows={2}
            defaultValue={initial.environmentDescription}
            className="text-xs"
            data-testid="edit-environment"
          />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium">Observed result</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {OBSERVED.map((o) => (
              <label
                key={o.value}
                className={cn(
                  "border-border hover:bg-muted flex cursor-pointer items-center justify-center rounded-md border px-2 py-1.5 text-xs",
                  observed === o.value && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="radio"
                  name="observedResult"
                  value={o.value}
                  checked={observed === o.value}
                  onChange={() => setObserved(o.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
          {errors.observedResult ? (
            <p className="text-destructive text-xs">{errors.observedResult}</p>
          ) : null}
        </fieldset>
        <Field label="Notes" htmlFor="edit-notes" error={errors.notes}>
          <Textarea
            id="edit-notes"
            name="notes"
            rows={3}
            defaultValue={initial.notes}
            className="text-xs"
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="stdout (optional)" htmlFor="edit-stdout" error={errors.stdout}>
            <Textarea
              id="edit-stdout"
              name="stdout"
              rows={3}
              defaultValue={initial.stdout}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="stderr (optional)" htmlFor="edit-stderr" error={errors.stderr}>
            <Textarea
              id="edit-stderr"
              name="stderr"
              rows={3}
              defaultValue={initial.stderr}
              className="font-mono text-xs"
            />
          </Field>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="size-3.5" aria-hidden />
          Commands are stored as text for reviewers and are never executed by MutantHub.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Note for reviewers</h2>
        <Field
          label="What changed and why? (optional)"
          htmlFor="edit-reason"
          error={errors.editReason}
          hint="Recorded in the mutant history together with the list of edited fields."
        >
          <Textarea
            id="edit-reason"
            name="editReason"
            rows={2}
            className="text-xs"
            data-testid="edit-reason"
          />
        </Field>
      </section>

      {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

      <div className="flex justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={routes.mutant(initial.mutantId)}>Cancel</Link>
        </Button>
        <Button type="submit" size="sm" disabled={pending} data-testid="edit-submit">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
