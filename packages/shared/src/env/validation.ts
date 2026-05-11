import type { z } from "zod";

import type { EnvironmentVariableDefinitionSchema } from "../schemas/platform.js";

export type EnvironmentValidationError = {
  key: string;
  message: string;
};

export const validateEnvironmentValues = (
  definitions: z.infer<typeof EnvironmentVariableDefinitionSchema>[],
  values: Record<string, string>,
): EnvironmentValidationError[] => {
  const errors: EnvironmentValidationError[] = [];

  for (const definition of definitions) {
    const value = values[definition.key] ?? definition.defaultValue ?? "";

    if (definition.required && !value) {
      errors.push({
        key: definition.key,
        message: `${definition.key} is required.`,
      });
      continue;
    }

    if (definition.allowedValues?.length && value) {
      const allowed = new Set(definition.allowedValues);
      if (!allowed.has(value)) {
        errors.push({
          key: definition.key,
          message: `${definition.key} must be one of: ${definition.allowedValues.join(", ")}.`,
        });
      }
    }

    if (definition.validationRule && value) {
      const expression = new RegExp(definition.validationRule);
      if (!expression.test(value)) {
        errors.push({
          key: definition.key,
          message: `${definition.key} did not match the required format.`,
        });
      }
    }
  }

  return errors;
};

export const maskSecretValues = (
  definitions: z.infer<typeof EnvironmentVariableDefinitionSchema>[],
  values: Record<string, string>,
) =>
  Object.fromEntries(
    definitions.map((definition) => [
      definition.key,
      definition.secret && values[definition.key]
        ? "••••••••"
        : (values[definition.key] ?? ""),
    ]),
  );
