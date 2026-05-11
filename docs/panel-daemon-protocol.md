# Panel-to-Daemon Protocol

The panel never talks to daemons directly. The API owns all node communication.

## Registration

`POST /v1/daemon/register`

Request:

```json
{
  "nodeId": "node_123",
  "bootstrapToken": "nd_bootstrap_...",
  "fingerprint": "sha256-of-machine-or-installation"
}
```

Response:

```json
{
  "daemonToken": "nd_live_...",
  "node": {
    "id": "node_123",
    "name": "Sydney-01"
  }
}
```

## WebSocket Session

The daemon connects to `GET /v1/daemon/socket?nodeId=<nodeId>` with `Authorization: Bearer <daemonToken>`.

## Message Types

### API to Daemon

- `server.create`
- `server.start`
- `server.stop`
- `server.restart`
- `server.kill`
- `server.rebuild`
- `server.delete`
- `server.syncEnvironment`
- `server.files.write`
- `server.files.delete`
- `server.backup.create`
- `node.tunnel.configure`

### Daemon to API

- `daemon.ready`
- `daemon.metrics`
- `daemon.log`
- `server.status`
- `server.console`
- `server.backup.completed`
- `command.result`

## Reliability Rules

- Every command includes a `requestId`.
- The daemon answers with `command.result`.
- The API times out commands that receive no response.
- Metrics are fire-and-forget and written asynchronously.
- Console output can be buffered and chunked by the daemon.

## Token Security

- Bootstrap tokens are one-time onboarding secrets.
- Daemon tokens are hashed at rest.
- Rotation invalidates the previous token after a grace period.
- TLS is required in production.
