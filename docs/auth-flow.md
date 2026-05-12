# Authentication Flow

## Identity

Leviathan uses built-in local accounts stored in the panel MariaDB database.

- Users sign in with username or email plus password.
- Passwords are hashed server-side before storage.
- The panel uses Leviathan-native local auth instead of an external identity provider.
- API keys remain available for automation and integrations.

## Sign-In Flow

1. User submits username/email and password to `POST /v1/auth/login`.
2. The API verifies the local password hash.
3. The API creates a server-side session record.
4. The API sets an `HttpOnly` session cookie.
5. The panel calls `GET /v1/auth/me` and `GET /v1/me` using that cookie-backed session.
6. The API resolves roles, permissions, and server grants from the panel database.

## Authorization

Authorization is handled entirely in the API.

- Roles reference permission strings.
- Built-in admin role can use `*`.
- Feature routes call shared permission guards.
- Sub-user access is represented as server-scoped grants.
- API keys carry explicit scopes and never reuse browser sessions.

## Daemon Identity

Node daemons never use browser sessions.

1. Admin creates a node in the panel.
2. The API generates a bootstrap token for that node.
3. The daemon installer is run with the bootstrap token.
4. The daemon exchanges the bootstrap token for a long-lived daemon token.
5. The daemon opens a WebSocket to the API using the daemon token.
6. Token rotation can be triggered later without reinstalling the node.

## Local Development

For local development, the API can run in mock auth mode. In that mode:

- `Authorization: Bearer dev-admin` maps to an admin user.
- `Authorization: Bearer dev-user` maps to a standard user.
- The panel can also use `VITE_USE_MOCK_AUTH=true`.

This keeps local iteration fast while reserving real SQL-backed auth for production and staging installs.
