import type { MetricPointRecord } from "@voltan/shared";

import { store } from "./store.js";
import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

export const evaluateMetricAlerts = async (points: MetricPointRecord[]) => {
  const rules = (await store.listAlertRules()).filter((rule) => rule.enabled);
  for (const point of points) {
    for (const rule of rules) {
      if (
        rule.scopeType !== "global" &&
        (rule.scopeType !== point.scopeType || rule.scopeId !== point.scopeId)
      ) {
        continue;
      }

      const memoryUsedMb = point.values.memoryUsedMb ?? 0;
      const diskUsedMb = point.values.diskUsedMb ?? 0;
      const value =
        rule.type === "cpu.high"
          ? point.values.cpuPercent
          : rule.type === "ram.high"
            ? point.values.memoryTotalMb
              ? (memoryUsedMb / point.values.memoryTotalMb) * 100
              : point.values.memoryLimitMb
                ? (memoryUsedMb / point.values.memoryLimitMb) * 100
                : undefined
            : rule.type === "disk.high"
              ? point.values.diskTotalMb
                ? (diskUsedMb / point.values.diskTotalMb) * 100
                : undefined
              : undefined;

      if (value === undefined || rule.threshold === undefined) {
        continue;
      }
      if (value < rule.threshold) {
        continue;
      }

      const event = await store.createAlertEvent({
        ruleId: rule.id,
        type: rule.type,
        severity: rule.severity,
        scopeType: point.scopeType,
        scopeId: point.scopeId,
        title: rule.name,
        message: `${rule.type} threshold ${rule.threshold} exceeded with ${value.toFixed(1)}`,
        status: "open",
      });
      await dispatchWebhookEvent("alert.created", {
        alertId: event.id,
        type: event.type,
        severity: event.severity,
        scopeType: event.scopeType,
        scopeId: event.scopeId,
      });
    }
  }
};

export const createSystemAlert = async (input: {
  type:
    | "node.offline"
    | "server.crashed"
    | "backup.failed"
    | "daemon.reconnect_loop";
  scopeType: "node" | "server" | "global";
  scopeId?: string;
  title: string;
  message: string;
}) =>
  store.createAlertEvent({
    ...input,
    severity: "warning",
    status: "open",
  });
