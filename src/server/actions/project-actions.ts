"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { projectService } from "@/server/services/project-service";
import { routes } from "@/lib/routes";
import { formToObject, runAction, type ActionResult } from "./result";

export async function registerProjectAction(
  _prev: ActionResult<{ owner: string; repo: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ owner: string; repo: string }>> {
  const result = await runAction(async () => {
    const user = await getCurrentUser();
    const project = await projectService.registerProject(user, formToObject(formData));
    revalidatePath(routes.projects());
    return { owner: project.githubOwner, repo: project.githubRepository };
  });
  if (result.ok) redirect(routes.project(result.data.owner, result.data.repo));
  return result;
}

export async function toggleFollowAction(
  projectId: string,
  following: boolean,
  owner: string,
  repo: string,
) {
  return runAction(async () => {
    const user = await getCurrentUser();
    await projectService.setFollowing(user, projectId, following);
    revalidatePath(routes.project(owner, repo));
    revalidatePath(routes.dashboard());
    return { following };
  });
}

export interface MemberResult {
  userId: string;
  username?: string;
  role?: string;
}

export async function addMemberAction(
  _prev: ActionResult<MemberResult> | null,
  formData: FormData,
): Promise<ActionResult<MemberResult>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const result = await projectService.addMember(user, formToObject(formData));
    revalidateProject(formData);
    return result;
  });
}

export async function changeMemberRoleAction(
  _prev: ActionResult<MemberResult> | null,
  formData: FormData,
): Promise<ActionResult<MemberResult>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const member = await projectService.changeMemberRole(user, formToObject(formData));
    revalidateProject(formData);
    return { userId: member.userId, role: member.role };
  });
}

export async function removeMemberAction(
  _prev: ActionResult<MemberResult> | null,
  formData: FormData,
): Promise<ActionResult<MemberResult>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const result = await projectService.removeMember(user, formToObject(formData));
    revalidateProject(formData);
    return result;
  });
}

export async function setProjectActiveAction(
  _prev: ActionResult<{ isActive: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ isActive: boolean }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const project = await projectService.setActive(user, formToObject(formData));
    revalidateProject(formData);
    revalidatePath(routes.projects());
    return { isActive: project.isActive };
  });
}

export async function refreshProjectAction(
  _prev: ActionResult<{ displayName: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ displayName: string }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const project = await projectService.refreshFromGitHub(
      user,
      String(formData.get("projectId") ?? ""),
    );
    revalidateProject(formData);
    return { displayName: project.displayName };
  });
}

/** The forms carry owner/repo so the overview and settings pages can be revalidated. */
function revalidateProject(formData: FormData) {
  const owner = String(formData.get("owner") ?? "");
  const repo = String(formData.get("repo") ?? "");
  if (!owner || !repo) return;
  revalidatePath(routes.project(owner, repo));
  revalidatePath(routes.projectSettings(owner, repo));
}
