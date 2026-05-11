import { describe, expect, it } from "vitest";

import { validateEnvironmentValues } from "./validation.js";

describe("validateEnvironmentValues", () => {
  it("returns errors for missing or invalid values", () => {
    const errors = validateEnvironmentValues(
      [
        {
          key: "MODE",
          displayName: "Mode",
          required: true,
          secret: false,
          readonly: false,
          allowedValues: ["dev", "prod"],
        },
      ],
      { MODE: "staging" },
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]?.key).toBe("MODE");
  });
});
