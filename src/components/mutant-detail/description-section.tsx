"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { editDescriptionAction } from "@/server/actions/mutant-actions";
import { Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/validation/limits";

interface DescriptionSectionProps {
  mutantId: number;
  description: string | null;
  canEdit: boolean;
  /** The rendered description (Markdown is rendered on the server). */
  children?: React.ReactNode;
}

/**
 * Mutant description with an inline editor for its owner. Available at any
 * review status; hidden entirely when there is nothing to show or edit.
 */
export function DescriptionSection({
  mutantId,
  description,
  canEdit,
  children,
}: DescriptionSectionProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof editDescriptionAction>> | null, formData: FormData) => {
      const result = await editDescriptionAction(prev, formData);
      if (result.ok) {
        toast.success(result.data.changed ? "Description updated" : "No changes to save");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );

  if (!description && !canEdit) return null;

  return (
    <Section
      title="Description"
      actions={
        canEdit && !editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            data-testid="description-edit"
          >
            <Pencil className="size-3.5" aria-hidden /> {description ? "Edit" : "Add"}
          </Button>
        ) : null
      }
    >
      {editing ? (
        <form action={formAction} className="space-y-2" data-testid="description-form">
          <input type="hidden" name="mutantId" value={mutantId} />
          <Textarea
            name="description"
            rows={6}
            defaultValue={description ?? ""}
            maxLength={LIMITS.description}
            placeholder="Why is this mutant interesting? Markdown is supported."
            className="text-sm"
            data-testid="description-input"
          />
          {state && !state.ok ? <p className="text-destructive text-xs">{state.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending} data-testid="description-submit">
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Save description
            </Button>
          </div>
        </form>
      ) : description ? (
        children
      ) : (
        <p className="text-muted-foreground text-xs">No description yet.</p>
      )}
    </Section>
  );
}
