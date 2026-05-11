# Firestore Schema

Leviathan uses Firestore as the system of record. Each collection is designed so documents can be read independently where possible, while still supporting denormalized dashboard views.

## Collections

### `users/{userId}`

```json
{
  "uid": "firebase uid",
  "email": "owner@example.com",
  "displayName": "Owner",
  "photoUrl": "https://...",
  "roleIds": ["admin"],
  "serverIds": ["srv_123"],
  "twoFactorRequired": false,
  "disabled": false,
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp"
}
```

### `roles/{roleId}`

```json
{
  "name": "Administrator",
  "permissions": ["*"],
  "builtin": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `servers/{serverId}`

```json
{
  "id": "srv_123",
  "name": "Survival EU",
  "ownerId": "firebase uid",
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
  "environmentAudit": [
    {
      "changedBy": "firebase uid",
      "changedAt": "timestamp",
      "keys": ["VERSION"]
    }
  ],
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastCrashAt": "timestamp|null"
}
```

### `nodes/{nodeId}`

```json
{
  "id": "node_123",
  "name": "Sydney-01",
  "region": "ap-southeast-2",
  "baseUrl": "https://panel.example.com",
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

### `templates/{templateId}`

```json
{
  "id": "tpl_minecraft_java",
  "name": "Minecraft Java",
  "category": "game",
  "description": "Vanilla or Paper-compatible Java server",
  "dockerImages": [
    "itzg/minecraft-server:latest",
    "ghcr.io/papermc/paper:latest"
  ],
  "startupCommand": "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui",
  "environmentDefinitions": [
    {
      "key": "EULA",
      "displayName": "Accept EULA",
      "required": true,
      "defaultValue": "TRUE",
      "secret": false,
      "readonly": false
    }
  ],
  "importedEnvExample": "raw file content",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `allocations/{allocationId}`

```json
{
  "nodeId": "node_123",
  "ip": "203.0.113.10",
  "port": 25565,
  "assignedServerId": "srv_123|null",
  "notes": "Primary game port",
  "createdAt": "timestamp"
}
```

### `backups/{backupId}`

Metadata only. Actual objects may live on local disk, S3-compatible storage, or SFTP targets.

### `scheduledTasks/{taskId}`

Stores cron expressions, enabled state, last run metadata, and task target definitions.

### `auditLogs/{auditId}`

```json
{
  "actorId": "firebase uid or system",
  "actorType": "user",
  "action": "server.environment.update",
  "targetType": "server",
  "targetId": "srv_123",
  "metadata": {
    "changedKeys": ["VERSION"]
  },
  "createdAt": "timestamp"
}
```

### `apiKeys/{keyId}`

Stores hashed keys, owner, scopes, optional expiry, revocation state, key prefix, and last usage data. Raw API keys are never stored.

### `webhooks/{webhookId}`

Stores endpoint URL, event filters, secret, enabled status, and delivery preferences.

### `webhookDeliveries/{deliveryId}`

Stores event name, webhook ID, signed payload metadata, response status, attempt count, next retry time, and delivery state.

### `alertRules/{ruleId}`

Stores threshold definitions, destinations, cooldowns, and per-node/per-server targeting.

### `alertEvents/{alertId}`

Stores triggered alerts, acknowledgement/resolution state, severity, scope, message, and timestamps.

### `metrics/{metricId}`

Stores time-bucketed resource snapshots keyed by node, server, and time window.

### `jobs/{jobId}`

Stores queue jobs for scheduled tasks and future background work. Job records include `status`, `attempts`, `maxAttempts`, `runAfter`, `lockedBy`, `lockedUntil`, and completion/error fields.

### `backupTargets/{targetId}`

Stores local or S3-compatible backup target configuration. S3 credentials must be protected by Firestore IAM and are redacted from panel responses and audit metadata.

### `domainMappings/{mappingId}`

Stores per-server domain/subdomain routing metadata for reverse proxy config generation.

### `firewallRules/{ruleId}`

Stores per-node or per-server allow/deny rules. Daemon providers generate implementation-specific commands from these records.

### `settings/global`

Stores installation-wide defaults such as branding, default limits, SMTP, backup defaults, and Cloudflare integration settings.

### `marketplacePlugins/{pluginId}`

Stores plugin metadata, versions, permissions, and enabled state for the future addon system.

## Index Guidance

- `servers` by `ownerId`, `nodeId`, `status`
- `nodes` by `status`, `maintenanceMode`
- `auditLogs` by `targetId` and `createdAt desc`
- `metrics` by `scopeId` and `bucketStart desc`
- `scheduledTasks` by `serverId` and `enabled`

## Secret Handling

Secret environment variable values are stored encrypted or wrapped at the repository boundary in production deployments. The first implementation redacts them in API responses and audit entries, and provides a clear adapter boundary for plugging in a KMS-backed encryptor later.
