import type { FirewallRuleRecord } from "@voltan/shared";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type FirewallApplyResult = {
  provider: "ufw";
  dryRun: boolean;
  commands: string[][];
  applied: boolean;
};

export const buildUfwCommands = (rules: FirewallRuleRecord[]) =>
  rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const action = rule.action === "allow" ? "allow" : "deny";
      const proto = rule.protocol === "udp" ? "udp" : "tcp";
      return [
        action,
        "from",
        rule.source,
        "to",
        "any",
        "port",
        String(rule.port),
        "proto",
        proto,
        "comment",
        `leviathan:${rule.scope}:${rule.scopeId ?? "global"}:${rule.id}`,
      ];
    });

export const applyFirewallRules = async (
  rules: FirewallRuleRecord[],
  dryRun = true,
): Promise<FirewallApplyResult> => {
  const commands = buildUfwCommands(rules);
  if (!dryRun && process.env.FIREWALL_APPLY_ENABLED === "true") {
    for (const args of commands) {
      await execFileAsync("ufw", args, { timeout: 10_000 });
    }
    return { provider: "ufw", dryRun, commands, applied: true };
  }
  return { provider: "ufw", dryRun, commands, applied: false };
};
