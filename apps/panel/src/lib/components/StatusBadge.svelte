<script lang="ts">
  export type BadgeTone =
    | "online"
    | "offline"
    | "starting"
    | "stopping"
    | "installing"
    | "suspended"
    | "failed"
    | "updating"
    | "maintenance"
    | "synced"
    | "out-of-sync"
    | "dry-run"
    | "applied"
    | "revoked"
    | "expired"
    | "warning";

  export let status = "";
  export let tone: BadgeTone | "" = "";
  export let label = "";

  const normalized = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "-");

  const badgeTone = (): BadgeTone => {
    if (tone) {
      return tone;
    }

    switch (normalized(status)) {
      case "online":
      case "running":
      case "healthy":
      case "active":
      case "synced":
      case "applied":
        return "online";
      case "offline":
      case "failed":
      case "error":
      case "crashed":
      case "revoked":
        return "offline";
      case "starting":
      case "stopping":
      case "installing":
      case "updating":
        return "updating";
      case "maintenance":
      case "suspended":
      case "dry-run":
      case "expired":
      case "out-of-sync":
        return "warning";
      default:
        return "warning";
    }
  };

  const output = () => label || status || "Status";
</script>

<span class={`status-pill status-${badgeTone()}`}>{output()}</span>

