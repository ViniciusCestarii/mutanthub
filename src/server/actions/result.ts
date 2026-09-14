import { isAppError } from "@/lib/errors";

/** Uniform server-action result consumed by `useActionState` forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(
  error: string,
  fieldErrors?: Record<string, string>,
  code?: string,
): ActionResult<T> {
  return { ok: false, error, fieldErrors, code };
}

/** Runs a service call and converts thrown AppErrors into a failed result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (isAppError(e)) return fail(e.message, e.details, e.code);
    console.error("Unhandled action error", e);
    return fail("Something went wrong. Please try again.");
  }
}

/** Converts FormData into a plain object (repeated keys are ignored on purpose). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
