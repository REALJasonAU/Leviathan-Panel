import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { mapBillingEventToAction, verifyStripeSignature } from "./billing.js";

describe("billing integration helpers", () => {
  it("validates stripe signatures", () => {
    const payload = JSON.stringify({ ok: true });
    const timestamp = "123";
    const secret = "whsec_test";
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    expect(
      verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret),
    ).toBe(true);
    expect(
      verifyStripeSignature(payload, `t=${timestamp},v1=bad`, secret),
    ).toBe(false);
  });

  it("maps billing events to server actions", () => {
    expect(mapBillingEventToAction("invoice.paid")).toBe("provision");
    expect(mapBillingEventToAction("service.suspend")).toBe("suspend");
    expect(mapBillingEventToAction("service.unsuspend")).toBe("unsuspend");
    expect(mapBillingEventToAction("service.cancelled")).toBe("terminate");
  });
});
