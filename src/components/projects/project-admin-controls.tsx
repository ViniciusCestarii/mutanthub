"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pause, Play, RefreshCw } from "lucide-react";
import { refreshProjectAction, setProjectActiveAction } from "@/server/actions/project-actions";
import { Button } from "@/components/ui/button";

interface ProjectAdminControlsProps {
  projectId: string;
  owner: string;
  repo: string;
  isActive: boolean;
}

/** Refresh metadata from GitHub and activate / deactivate the project. */
export function ProjectAdminControls({
  projectId,
  owner,
  repo,
  isActive,
}: ProjectAdminControlsProps) {
  const router = useRouter();

  const [, refreshAction, refreshing] = useActionState(
    async (prev: Awaited<ReturnType<typeof refreshProjectAction>> | null, formData: FormData) => {
      const result = await refreshProjectAction(prev, formData);
      if (result.ok) {
        toast.success(`Metadata refreshed for ${result.data.displayName}`);
        router.refresh();
      } else toast.error(result.error);
      return result;
    },
    null,
  );
  const [, activeAction, toggling] = useActionState(
    async (prev: Awaited<ReturnType<typeof setProjectActiveAction>> | null, formData: FormData) => {
      const result = await setProjectActiveAction(prev, formData);
      if (result.ok) {
        toast.success(result.data.isActive ? "Project reactivated" : "Project deactivated");
        router.refresh();
      } else toast.error(result.error);
      return result;
    },
    null,
  );

  const hidden = (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="repo" value={repo} />
    </>
  );

  return (
    <div className="space-y-4" data-testid="project-admin-controls">
      <form action={refreshAction} className="flex flex-wrap items-center justify-between gap-3">
        {hidden}
        <div className="text-xs">
          <p className="font-medium">Refresh from GitHub</p>
          <p className="text-muted-foreground">
            Re-reads the description, default branch and language. Mutants are unaffected.
          </p>
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={refreshing}
          data-testid="refresh-project"
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden />
          )}
          Refresh metadata
        </Button>
      </form>

      <form
        action={activeAction}
        className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4"
      >
        {hidden}
        <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
        <div className="text-xs">
          <p className="font-medium">{isActive ? "Deactivate project" : "Reactivate project"}</p>
          <p className="text-muted-foreground">
            {isActive
              ? "Hides the project from lists and stops new submissions. Existing mutants, reproductions and history stay readable."
              : "The project is currently inactive: it is hidden from lists and rejects new submissions."}
          </p>
        </div>
        <Button
          type="submit"
          variant={isActive ? "destructive" : "default"}
          size="sm"
          disabled={toggling}
          data-testid="toggle-project-active"
        >
          {toggling ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : isActive ? (
            <Pause className="size-3.5" aria-hidden />
          ) : (
            <Play className="size-3.5" aria-hidden />
          )}
          {isActive ? "Deactivate" : "Reactivate"}
        </Button>
      </form>
    </div>
  );
}
