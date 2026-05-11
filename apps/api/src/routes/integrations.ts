import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { BillingWebhookEnvelopeSchema } from "@voltan/shared";

import { config } from "../config.js";
import {
  mapBillingEventToAction,
  safeEqual,
  verifyStripeSignature,
} from "../lib/billing.js";
import { AppError } from "../lib/errors.js";
import { parseBody, parseParams } from "../lib/http.js";

const BillingProviderParamSchema = z.object({
  provider: z.enum(["stripe", "whmcs"]),
});

export const registerIntegrationRoutes = async (fastify: FastifyInstance) => {
  fastify.post(
    "/v1/integrations/billing/:provider/webhook",
    async (request) => {
      const { provider } = parseParams(request, BillingProviderParamSchema);
      const input = parseBody(request, BillingWebhookEnvelopeSchema);
      if (input.provider !== provider) {
        throw new AppError(
          422,
          "BILLING_PROVIDER_MISMATCH",
          "Webhook provider does not match the route",
        );
      }

      const signature = String(
        provider === "stripe"
          ? (request.headers["stripe-signature"] ?? "")
          : (request.headers["x-whmcs-signature"] ?? ""),
      );
      if (!signature) {
        throw new AppError(
          401,
          "BILLING_SIGNATURE_REQUIRED",
          "Billing webhooks require provider signature headers",
        );
      }
      const body = JSON.stringify(input);
      const valid =
        provider === "stripe"
          ? config.STRIPE_WEBHOOK_SECRET
            ? verifyStripeSignature(
                body,
                signature,
                config.STRIPE_WEBHOOK_SECRET,
              )
            : true
          : config.WHMCS_WEBHOOK_SECRET
            ? safeEqual(signature, config.WHMCS_WEBHOOK_SECRET)
            : true;
      if (!valid) {
        throw new AppError(
          401,
          "BILLING_SIGNATURE_INVALID",
          "Billing webhook signature validation failed",
        );
      }

      return {
        accepted: true,
        provider,
        event: input.event,
        action: mapBillingEventToAction(input.event),
        provisionerHook:
          "Implement BillingProvisioner.provision/suspend/unsuspend for this deployment.",
      };
    },
  );
};
