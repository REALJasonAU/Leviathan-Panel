import { createHmac } from "node:crypto";

import { store } from "./store.js";
import { decryptSecret } from "./secrets.js";

const signPayload = (secret: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const buildPayload = (
  type: "generic" | "discord",
  event: string,
  payload: Record<string, unknown>,
) => {
  if (type === "discord") {
    return {
      content: null,
      embeds: [
        {
          title: event,
          color:
            event.includes("failed") || event.includes("crash")
              ? 0xff5555
              : 0x4ade80,
          fields: Object.entries(payload).map(([name, value]) => ({
            name,
            value: String(value),
            inline: true,
          })),
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  return {
    event,
    data: payload,
    sentAt: new Date().toISOString(),
  };
};

export const dispatchWebhookEvent = async (
  event: string,
  payload: Record<string, unknown>,
) => {
  const webhooks = await store.listWebhooks();
  const targets = webhooks.filter(
    (webhook) => webhook.enabled && webhook.events.includes(event),
  );

  await Promise.all(
    targets.map(async (webhook) => {
      const body = JSON.stringify(buildPayload(webhook.type, event, payload));
      const secret = decryptSecret(webhook.secret);
      const delivery = await store.createWebhookDelivery({
        webhookId: webhook.id,
        event,
        payload,
        status: "pending",
        attempts: 0,
      });
      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(secret
              ? { "x-leviathan-signature": signPayload(secret, body) }
              : {}),
          },
          body,
        });
        await store.updateWebhookDelivery(delivery.id, {
          status: response.ok ? "delivered" : "failed",
          attempts: delivery.attempts + 1,
          responseStatus: response.status,
          errorMessage: response.ok ? undefined : response.statusText,
          nextAttemptAt: response.ok
            ? undefined
            : new Date(Date.now() + 60_000).toISOString(),
        });
      } catch (error) {
        await store.updateWebhookDelivery(delivery.id, {
          status: "failed",
          attempts: delivery.attempts + 1,
          errorMessage:
            error instanceof Error ? error.message : "Webhook delivery failed",
          nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
        });
      }
    }),
  );
};

export const verifyWebhookSignature = (
  secret: string,
  body: string,
  signature: string | undefined,
) => signature === signPayload(secret, body);
