/**
 * Application error types. Services throw these; server actions and route
 * handlers translate them into form errors or HTTP responses.
 */
export type AppErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.status = STATUS_BY_CODE[code];
  }
}

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
};

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = (message = "You do not have permission to do this") =>
  new AppError("FORBIDDEN", message);
export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Sign in to continue");
export const validationError = (message: string, details?: Record<string, string>) =>
  new AppError("VALIDATION", message, details);
export const conflict = (message: string) => new AppError("CONFLICT", message);

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}
