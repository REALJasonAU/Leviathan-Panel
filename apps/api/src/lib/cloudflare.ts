import type { CloudflareRouteRecord, SettingsRecord } from "@voltan/shared";

import { decryptSecret } from "./secrets.js";

type CloudflareResult = {
  dryRun: boolean;
  operations: Array<{ method: string; url: string; body?: unknown }>;
  responses: unknown[];
};

const apiBase = "https://api.cloudflare.com/client/v4";

const requestCloudflare = async (
  token: string,
  method: string,
  path: string,
  body?: unknown,
) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cloudflare ${method} ${path} failed: ${response.status}`);
  }
  return payload;
};

export const syncCloudflareRoute = async (
  settings: SettingsRecord,
  route: CloudflareRouteRecord,
  dryRun = true,
): Promise<CloudflareResult> => {
  const token = decryptSecret(settings.cloudflare.apiToken);
  const zoneId = route.zoneId || settings.cloudflare.zoneId;
  if (!token || !zoneId) {
    throw new Error("Cloudflare API token and zone ID are required");
  }

  const dnsBody = {
    type: "CNAME",
    name: route.hostname,
    content: `${route.tunnelId}.cfargotunnel.com`,
    proxied: true,
    ttl: 1,
  };
  const tunnelBody = {
    hostname: route.hostname,
    service: route.service,
  };
  const operations = [
    {
      method: route.dnsRecordId ? "PUT" : "POST",
      url: `/zones/${zoneId}/dns_records${route.dnsRecordId ? `/${route.dnsRecordId}` : ""}`,
      body: dnsBody,
    },
    {
      method: "PUT",
      url: `/accounts/${settings.cloudflare.accountId}/cfd_tunnel/${route.tunnelId}/configurations`,
      body: {
        config: {
          ingress: [tunnelBody, { service: "http_status:404" }],
        },
      },
    },
  ];

  if (dryRun) {
    return { dryRun, operations, responses: [] };
  }

  const responses = [];
  for (const operation of operations) {
    responses.push(
      await requestCloudflare(
        token,
        operation.method,
        operation.url,
        operation.body,
      ),
    );
  }
  return { dryRun, operations, responses };
};

export const deleteCloudflareRoute = async (
  settings: SettingsRecord,
  route: CloudflareRouteRecord,
  dryRun = true,
): Promise<CloudflareResult> => {
  const token = decryptSecret(settings.cloudflare.apiToken);
  const zoneId = route.zoneId || settings.cloudflare.zoneId;
  const operations = route.dnsRecordId
    ? [
        {
          method: "DELETE",
          url: `/zones/${zoneId}/dns_records/${route.dnsRecordId}`,
        },
      ]
    : [];
  if (dryRun) {
    return { dryRun, operations, responses: [] };
  }
  if (!token || !zoneId) {
    throw new Error("Cloudflare API token and zone ID are required");
  }
  const responses = [];
  for (const operation of operations) {
    responses.push(
      await requestCloudflare(token, operation.method, operation.url),
    );
  }
  return { dryRun, operations, responses };
};
