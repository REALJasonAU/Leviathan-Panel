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
