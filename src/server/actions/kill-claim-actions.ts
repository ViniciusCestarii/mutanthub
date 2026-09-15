"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/session";
import { killClaimService } from "@/server/services/kill-claim-service";
import { routes } from "@/lib/routes";
import { formToObject, runAction, type ActionResult } from "./result";

export async function createKillClaimAction(
  _prev: ActionResult<{ claimId: string; status: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ claimId: string; status: string }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const claim = await killClaimService.create(user, formToObject(formData));
    revalidatePath(routes.mutant(claim.mutantId));
    return { claimId: claim.id, status: claim.status };
  });
}

export async function resolveKillClaimAction(
  _prev: ActionResult<{ claimId: string; status: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ claimId: string; status: string }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const claim = await killClaimService.resolve(user, formToObject(formData));
    revalidatePath(routes.mutant(claim.mutantId));
    return { claimId: claim.id, status: claim.status };
  });
}

export async function refreshKillClaimAction(
  _prev: ActionResult<{ claimId: string; status: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ claimId: string; status: string }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const claim = await killClaimService.refresh(user, String(formData.get("claimId") ?? ""));
    revalidatePath(routes.mutant(claim.mutantId));
    return { claimId: claim.id, status: claim.status };
  });
}
