"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { editTitleAction } from "@/server/actions/mutant-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIMITS } from "@/lib/validation/limits";

interface EditableTitleProps {
  mutantId: number;
  title: string;
  className?: string;
}

/** Mutant title with an inline editor for its owner, at any review status. */
export function EditableTitle({ mutantId, title, className }: EditableTitleProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof editTitleAction>> | null, formData: FormData) => {
      const result = await editTitleAction(prev, formData);
      if (result.ok) {
        toast.success(result.data.changed ? "Title updated" : "No changes to save");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );

  if (!editing) {
    return (
      <div className="flex items-start gap-1">
        <h1 className={className}>{title}</h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          aria-label="Edit title"
          data-testid="title-edit"
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2" data-testid="title-form">
      <input type="hidden" name="mutantId" value={mutantId} />
      <Input
        name="title"
        defaultValue={title}
        maxLength={LIMITS.title}
        placeholder="Leave empty to generate from the operator and location"
        autoFocus
        data-testid="title-input"
      />
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={pending} data-testid="title-submit">
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        Save
      </Button>
    </form>
  );
}
