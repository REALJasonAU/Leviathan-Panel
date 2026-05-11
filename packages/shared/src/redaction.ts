const sensitiveKeyPattern =
  /secret|token|password|private[_-]?key|access[_-]?key|api[_-]?key|signature/i;

export const isSensitiveKey = (key: string) => sensitiveKeyPattern.test(key);

export const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === "object") {
    return redactSecrets(value as Record<string, unknown>);
  }
  return value;
};

export const redactSecrets = (input: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? "[redacted]" : redactValue(value),
    ]),
  );
