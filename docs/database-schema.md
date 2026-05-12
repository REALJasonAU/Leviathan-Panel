# Database Schema

Leviathan uses MariaDB-backed document storage for the panel control plane and separate MariaDB-backed operational storage on each daemon node.

## Panel Control Plane Collections

These logical collections are stored in the panel database:

### `users`

```json
{
  "id": "usr_123",
  "email": "owner@example.com",
  "displayName": "Owner",
  "roleIds": ["admin"],
  "serverIds": ["srv_123"],
  "twoFactorRequired": false,
  "disabled": false,
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp"
}
```

### `localAccounts`

```json
{
  "userId": "usr_123",
  "username": "owner",
  "usernameLower": "owner",
  "emailLower": "owner@example.com",
  "passwordHash": "scrypt$...",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `sessions`

```json
{
  "id": "sess_123",
  "userId": "usr_123",
  "expiresAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `roles`

```json
{
  "name": "Administrator",
  "permissions": ["*"],
  "builtin": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `servers`

```json
{
  "id": "srv_123",
  "name": "Survival EU",
  "ownerId": "usr_123",
  "nodeId": "node_123",
  "templateId": "tpl_minecraft_java",
  "dockerImage": "itzg/minecraft-server:latest",
  "status": "offline",
  "suspended": false,
  "allocations": [{ "ip": "203.0.113.10", "port": 25565, "primary": true }],
  "limits": {
    "cpuPercent": 200,
    "memoryMb": 4096,
    "diskMb": 16384
  },
  "startup": {
    "command": "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui"
  },
  "environment": {
    "EULA": "TRUE",
    "VERSION": "1.20.6"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastCrashAt": "timestamp|null"
}
```

### `nodes`

```json
{
  "id": "node_123",
  "name": "Sydney-01",
  "region": "ap-southeast-2",
  "publicAddress": "203.0.113.30",
  "status": "online",
  "maintenanceMode": false,
  "platform": "linux",
  "capabilities": ["docker", "backups", "cloudflare-tunnel"],
  "bootstrapTokenHash": "sha256...",
  "daemonTokenHash": "sha256...",
  "lastSeenAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Additional control-plane collections

- `templates`
- `allocations`
- `backups`
- `scheduledTasks`
- `auditLogs`
- `apiKeys`
- `webhooks`
- `webhookDeliveries`
- `alertRules`
- `alertEvents`
- `metrics`
- `jobs`
- `backupTargets`
- `domainMappings`
- `firewallRules`
- `settings`
- `pluginManifests`
- `daemonUpdateHistory`
- `sftpCredentials`

## Daemon Local Collections

Each node stores its own operational records separately:

- `transfers`
- `localBackups`
- `localJobs`
- `runtimeMetrics`
- `updateHistory`
- `sftpCredentials`
- `healthEvents`

## Secret Handling

- Passwords are stored as hashes, never plaintext.
- API keys are stored hashed and only revealed once at creation time.
- Provider secrets are encrypted before persistence.
- Secrets are redacted from API responses, logs, and audit records unless intentionally revealed once.
