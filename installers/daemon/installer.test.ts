import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname);
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("daemon installer scripts", () => {
  const install = read("install.sh");
  const update = read("update.sh");
  const uninstall = read("uninstall.sh");

  it("detects supported distro families and package managers", () => {
    for (const token of [
      "/etc/os-release",
      "ubuntu",
      "debian",
      "fedora",
      "rocky",
      "almalinux",
      "centos",
      "arch",
      "apt",
      "dnf",
      "yum",
      "pacman",
    ]) {
      expect(install).toContain(token);
    }
  });

  it("supports required one-click flags and optional feature dependencies", () => {
    for (const token of [
      "--dry-run",
      "--skip-docker-install",
      "--non-interactive",
      "--enable-cloudflare",
      "--enable-firewall",
      "--enable-sftp-openssh",
      "--base-dir",
      "--daemon-port",
      "cloudflared",
      "ufw",
      "nftables",
      "openssh-server",
    ]) {
      expect(install).toContain(token);
    }
  });

  it("validates panel reachability, docker, and daemon service startup", () => {
    for (const token of [
      "validate_panel_reachable",
      "validate_docker",
      "validate_service",
      "/health",
      "useradd --system",
      "systemctl enable --now docker",
    ]) {
      expect(install).toContain(token);
    }
    expect(install).toMatch(
      /systemctl enable --now "\$\{SERVICE_NAME\}\.service"/,
    );
  });

  it("keeps update and uninstall scripts distro-safe and dry-run aware", () => {
    expect(update).toContain("--dry-run");
    expect(update).toMatch(/systemctl restart "\$\{SERVICE_NAME\}\.service"/);
    expect(update).toContain("pnpm build");
    expect(uninstall).toContain("--dry-run");
    expect(uninstall).toMatch(
      /systemctl disable --now "\$\{SERVICE_NAME\}\.service"/,
    );
    expect(uninstall).toContain("rm -rf");
  });
});
