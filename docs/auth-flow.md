# Authentication Flow

## Identity

Leviathan uses Firebase Authentication as the source of truth for end-user identity.

- Email and password can be enabled through Firebase.
- Google sign-in is supported through Firebase Auth.
- Optional Discord OAuth can be added later through Firebase custom providers or backend token exchange.

## Sign-In Flow

1. User signs in through Firebase from the panel.
2. Firebase issues an ID token to the browser.
3. The panel sends `Authorization: Bearer <id-token>` to the API.
4. The API verifies the token using Firebase Admin.
5. The API upserts the user profile in Firestore and resolves role assignments plus server grants.
6. The API returns a normalized `me` response with roles, permissions, and basic profile data.

## Authorization

Authorization is handled entirely in the API.

- Roles reference permission strings.
- Built-in admin role can use `*`.
- Feature routes call shared permission guards.
- Sub-user access is represented as server-scoped grants.

## Daemon Identity

Node daemons never use Firebase.

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

This keeps the full authorization path intact even when Firebase credentials are not available locally.
