"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { addCommentAction } from "@/server/actions/mutant-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/lib/routes";

interface CommentFormProps {
  mutantId: number;
  signedIn: boolean;
}

export function CommentForm({ mutantId, signedIn }: CommentFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof addCommentAction>> | null, formData: FormData) => {
      const result = await addCommentAction(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        toast.success("Comment posted");
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
        to join the discussion.
      </div>
    );
  }

  const fieldError = state && !state.ok ? state.fieldErrors?.body : undefined;
  const formError = state && !state.ok && !fieldError ? state.error : undefined;

  return (
    <form ref={formRef} action={formAction} className="space-y-2" data-testid="comment-form">
      <input type="hidden" name="mutantId" value={mutantId} />
      <Textarea
        name="body"
        rows={4}
        required
        placeholder="Share findings: equivalence arguments, reproduction difficulties, a test that kills this mutant..."
        className="text-sm"
        data-testid="comment-body"
        aria-invalid={fieldError ? true : undefined}
      />
      {fieldError ? <p className="text-destructive text-xs">{fieldError}</p> : null}
      {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          Markdown is supported. Links and HTML are sanitized.
        </span>
        <Button type="submit" size="sm" disabled={pending} data-testid="comment-submit">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <MessageSquare className="size-3.5" aria-hidden />
          )}
          Comment
        </Button>
      </div>
    </form>
  );
}
