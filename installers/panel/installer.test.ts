import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname);
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("panel installer scripts", () => {
  const install = read("install.sh");
  const update = read("update.sh");
  const uninstall = read("uninstall.sh");

  it("detects distro families and package managers", () => {
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

  it("supports dry-run, non-interactive, and docker install controls", () => {
    for (const token of [
      "--dry-run",
      "--non-interactive",
      "--skip-docker-install",
      "--api-port",
      "--panel-port",
      "--panel-origin",
      "validate_api_service",
      "validate_panel_service",
      "systemctl enable --now docker",
    ]) {
      expect(install).toContain(token);
    }
    expect(install).toMatch(
      /systemctl enable --now "\$\{API_SERVICE_NAME\}\.service"/,
    );
    expect(install).toMatch(
      /systemctl enable --now "\$\{PANEL_SERVICE_NAME\}\.service"/,
    );
  });

  it("supports update and uninstall dry-run flows", () => {
    expect(update).toContain("--dry-run");
    expect(update).toMatch(
      /systemctl restart "\$\{API_SERVICE_NAME\}\.service"/,
    );
    expect(update).toMatch(
      /systemctl restart "\$\{PANEL_SERVICE_NAME\}\.service"/,
    );
    expect(uninstall).toContain("--dry-run");
    expect(uninstall).toMatch(
      /systemctl disable --now "\$\{API_SERVICE_NAME\}\.service"/,
    );
    expect(uninstall).toMatch(
      /systemctl disable --now "\$\{PANEL_SERVICE_NAME\}\.service"/,
    );
  });
});
