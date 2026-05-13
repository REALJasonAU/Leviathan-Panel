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
      "--repo-url",
      "--repo-branch",
      "--api-port",
      "--panel-port",
      "--panel-origin",
      "--admin-username",
      "--admin-email",
      "--admin-password",
      "--db-name",
      "--db-user",
      "--db-password",
      "--disable-auto-update",
      "validate_api_service",
      "validate_panel_service",
      "systemctl enable --now docker",
      "mariadb",
      "mysql -uroot",
      "pnpm --filter @voltan/api seed",
      "git clone --depth 1 --branch",
      "curl -fsSL https://raw.githubusercontent.com/REALJasonAU/Leviathan-Panel/refs/heads/master/installers/panel/install.sh",
      "LeviathanInstallerSecret",
      ".leviathan-install.json",
      "|| true",
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
    expect(update).toContain("git fetch --all --prune");
    expect(update).toContain("git pull --ff-only");
    expect(update).toMatch(
      /systemctl restart "\$\{API_SERVICE_NAME\}\.service"/,
    );
    expect(update).toMatch(
      /systemctl restart "\$\{PANEL_SERVICE_NAME\}\.service"/,
    );
    expect(uninstall).toContain("--dry-run");
    expect(uninstall).toContain("UPDATE_TIMER_NAME");
    expect(uninstall).toContain(".leviathan-install.json");
    expect(uninstall).toMatch(
      /systemctl disable --now "\$\{API_SERVICE_NAME\}\.service"/,
    );
    expect(uninstall).toMatch(
      /systemctl disable --now "\$\{PANEL_SERVICE_NAME\}\.service"/,
    );
  });
});
