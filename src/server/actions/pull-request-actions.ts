"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { pullRequestService } from "@/server/services/pull-request-service";
import { routes } from "@/lib/routes";
import { formToObject, runAction, type ActionResult } from "./result";

export async function trackPullRequestAction(
  _prev: ActionResult<{ number: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ number: number }>> {
  const owner = String(formData.get("owner") ?? "");
  const repo = String(formData.get("repo") ?? "");
  const result = await runAction(async () => {
    const user = await getCurrentUser();
    const pr = await pullRequestService.track(user, formToObject(formData));
    revalidatePath(routes.projectPulls(owner, repo));
    return { number: pr.number };
  });
  if (result.ok && owner && repo) redirect(routes.projectPull(owner, repo, result.data.number));
  return result;
}

export async function syncPullRequestAction(formData: FormData): Promise<void> {
  const owner = String(formData.get("owner") ?? "");
  const repo = String(formData.get("repo") ?? "");
  const number = Number(formData.get("number") ?? 0);
  const user = await getCurrentUser();
  if (!user || !owner || !repo || !number) return;
  const project = await projectService.getBySlugOrThrow(owner, repo);
  await pullRequestService.sync(project, number);
  revalidatePath(routes.projectPull(owner, repo, number));
}
