import type { z } from "zod";

import { EnvironmentVariableDefinitionSchema } from "../schemas/platform.js";

const envLinePattern = /^(?<key>[A-Z0-9_]+)\s*=\s*(?<value>.*?)(\s+#.*)?$/i;

export const parseEnvExample = (content: string) => {
  const lines = content.split(/\r?\n/);
  const definitions: z.infer<typeof EnvironmentVariableDefinitionSchema>[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      notes.length = 0;
      continue;
    }

    if (trimmed.startsWith("#")) {
      notes.push(trimmed.replace(/^#\s?/, ""));
      continue;
    }

    const match = envLinePattern.exec(trimmed);
    if (!match?.groups?.key) {
      notes.length = 0;
      continue;
    }

    const rawValue = match.groups.value?.trim() ?? "";
    const value = rawValue.replace(/^["']|["']$/g, "");
    const required = value.length === 0;
    const secret = /secret|token|password|key/i.test(match.groups.key);

    definitions.push(
      EnvironmentVariableDefinitionSchema.parse({
        key: match.groups.key,
        displayName: match.groups.key.replaceAll("_", " "),
        description: notes.join(" ").trim() || undefined,
        defaultValue: value || undefined,
        required,
        secret,
        readonly: false,
        validationRule: undefined,
        allowedValues: [],
      }),
    );

    notes.length = 0;
  }

  return definitions;
};
