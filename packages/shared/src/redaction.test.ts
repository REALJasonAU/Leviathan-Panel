import { describe, expect, it } from "vitest";

import { redactSecrets } from "./redaction.js";

describe("redaction", () => {
  it("redacts nested sensitive keys", () => {
    expect(
      redactSecrets({
        token: "abc",
        nested: {
          secretAccessKey: "def",
          safe: "ok",
        },
      }),
    ).toEqual({
      token: "[redacted]",
      nested: {
        secretAccessKey: "[redacted]",
        safe: "ok",
      },
    });
  });
});
