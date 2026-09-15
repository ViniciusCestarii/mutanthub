"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";
import { routes } from "@/lib/routes";
import { runAction, type ActionResult } from "./result";

/** Marks the notification read, then navigates to its target. */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  let target = routes.notifications();
  try {
    target = await notificationService.open(user, id);
  } catch {
    /* unknown or foreign notification: fall through to the inbox */
  }
  revalidatePath(routes.notifications(), "layout");
  redirect(target);
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const count = await notificationService.markAllRead(user);
    revalidatePath(routes.notifications(), "layout");
    return { count };
  });
}

export async function markNotificationsReadAction(
  ids: string[],
): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    const count = await notificationService.markRead(user, ids.slice(0, 100));
    revalidatePath(routes.notifications(), "layout");
    return { count };
  });
}
