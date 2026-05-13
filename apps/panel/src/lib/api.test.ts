import { describe, expect, it } from "vitest";

import { resolveApiBaseUrls } from "./api";

describe("panel api base resolution", () => {
  it("prefers the current browser host over loopback config values", () => {
    expect(
      resolveApiBaseUrls("http://localhost:4000", {
        hostname: "76.13.216.192",
        protocol: "http:",
      }),
    ).toEqual(["http://76.13.216.192:4000"]);
  });

  it("keeps external api bases available as a fallback", () => {
    expect(
      resolveApiBaseUrls("https://api.leviathan.example", {
        hostname: "panel.leviathan.example",
        protocol: "https:",
      }),
    ).toEqual([
      "https://panel.leviathan.example:4000",
      "https://api.leviathan.example",
    ]);
  });
});
