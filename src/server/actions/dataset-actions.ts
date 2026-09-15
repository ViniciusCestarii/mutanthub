"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { datasetService } from "@/server/services/dataset-service";
import { routes } from "@/lib/routes";
import { formToObject, runAction, type ActionResult } from "./result";

export async function createSnapshotAction(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string }>> {
  const result = await runAction(async () => {
    const user = await getCurrentUser();
    const snapshot = await datasetService.createSnapshot(user, formToObject(formData));
    revalidatePath(routes.datasets());
    return { slug: snapshot.slug };
  });
  if (result.ok) redirect(routes.dataset(result.data.slug));
  return result;
}
