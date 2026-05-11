import { describe, expect, it } from "vitest";

import { parseEnvExample } from "./parser.js";

describe("parseEnvExample", () => {
  it("parses descriptions and secret-like keys", () => {
    const definitions = parseEnvExample(
      "# API token\nAPI_TOKEN=\n# Port value\nAPP_PORT=25565\n",
    );

    expect(definitions).toHaveLength(2);
    expect(definitions[0]?.key).toBe("API_TOKEN");
    expect(definitions[0]?.secret).toBe(true);
    expect(definitions[0]?.required).toBe(true);
    expect(definitions[1]?.defaultValue).toBe("25565");
  });
});
