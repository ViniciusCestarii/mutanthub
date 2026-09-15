"use client";

import { useActionState } from "react";
import { Loader2, PackagePlus } from "lucide-react";
import { createSnapshotAction } from "@/server/actions/dataset-actions";
import { MUTATION_STATUSES, REVIEW_STATUSES } from "@/domain/mutants/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateSnapshotFormProps {
  projects: Array<{ slug: string; name: string }>;
}

/** Admin form: freezes the mutants matching the filters into a citable snapshot. */
export function CreateSnapshotForm({ projects }: CreateSnapshotFormProps) {
  const [state, formAction, pending] = useActionState(createSnapshotAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok && !state.fieldErrors ? state.error : undefined;
  const select = "border-input bg-background h-8 w-full rounded-md border px-2 text-sm";

  return (
    <form action={formAction} className="space-y-3" data-testid="create-snapshot-form">
      <div className="space-y-1">
        <Label htmlFor="snapshot-name" className="text-xs">
          Name
        </Label>
        <Input
          id="snapshot-name"
          name="name"
          placeholder="Surviving mutants, September 2026"
          required
          data-testid="snapshot-name"
        />
        {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="snapshot-description" className="text-xs">
          Description (optional)
        </Label>
        <Textarea
          id="snapshot-description"
          name="description"
          rows={2}
          className="text-xs"
          placeholder="What this release contains and how it was selected."
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="snapshot-project" className="text-xs">
            Project
          </Label>
          <select
            id="snapshot-project"
            name="project"
            defaultValue=""
            className={select}
            data-testid="snapshot-project"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.project ? <p className="text-destructive text-xs">{errors.project}</p> : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="snapshot-review" className="text-xs">
            Review status
          </Label>
          <select id="snapshot-review" name="reviewStatus" defaultValue="" className={select}>
            <option value="">Any</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="snapshot-outcome" className="text-xs">
            Outcome
          </Label>
          <select id="snapshot-outcome" name="mutationStatus" defaultValue="" className={select}>
            <option value="">Any</option>
            {MUTATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      <p className="text-muted-foreground text-[11px]">
        Snapshots are permanent and public. Rows are frozen as published; later status changes do
        not alter them. Up to 50,000 rows.
      </p>
      <Button type="submit" size="sm" disabled={pending} data-testid="snapshot-submit">
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <PackagePlus className="size-3.5" aria-hidden />
        )}
        Publish snapshot
      </Button>
    </form>
  );
}
