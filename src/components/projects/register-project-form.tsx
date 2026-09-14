"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerProjectAction } from "@/server/actions/project-actions";

export function RegisterProjectForm() {
  const [state, formAction, pending] = useActionState(registerProjectAction, null);
  const fieldError = state && !state.ok ? state.fieldErrors?.repository : undefined;
  const formError = state && !state.ok && !fieldError ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-3" data-testid="register-project-form">
      <div className="space-y-1.5">
        <Label htmlFor="repository">GitHub repository</Label>
        <div className="flex gap-2">
          <Input
            id="repository"
            name="repository"
            placeholder="owner/repository"
            autoComplete="off"
            required
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "repository-error" : undefined}
            className="font-mono"
          />
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" aria-hidden /> {pending ? "Registering…" : "Register"}
          </Button>
        </div>
        {fieldError ? (
          <p
            id="repository-error"
            className="text-destructive text-xs"
            data-testid="register-project-error"
          >
            {fieldError}
          </p>
        ) : null}
        {formError ? (
          <p className="text-destructive text-xs" data-testid="register-project-error">
            {formError}
          </p>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Only public repositories can be registered. Metadata is read from GitHub; you become a
        maintainer of the new project.
      </p>
    </form>
  );
}
