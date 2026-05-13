import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const asAppError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    const statusCode = (error as { statusCode: number }).statusCode;
    const rawError = error as Record<string, unknown>;
    const code =
      typeof rawError.code === "string"
        ? rawError.code
        : statusCode === 401
          ? "UNAUTHORIZED"
          : statusCode === 403
            ? "FORBIDDEN"
            : statusCode === 404
              ? "NOT_FOUND"
              : "INTERNAL_ERROR";
    const message =
      typeof rawError.message === "string"
        ? rawError.message
        : "Request failed";
    const details =
      typeof rawError.validation !== "undefined"
        ? rawError.validation
        : undefined;
    return new AppError(statusCode, code, message, details);
  }

  if (error instanceof ZodError) {
    return new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      error.flatten(),
    );
  }

  if (error instanceof Error) {
    return new AppError(500, "INTERNAL_ERROR", error.message);
  }

  return new AppError(500, "INTERNAL_ERROR", "Unknown error");
};
