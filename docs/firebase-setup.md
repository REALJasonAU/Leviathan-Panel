# Firebase Setup

## 1. Create the project

1. Create a Firebase project in the Firebase console.
2. Enable Authentication.
3. Enable the Google provider.
4. Enable Firestore in native mode.

## 2. Configure the panel

Copy [examples/firebase/firebase.client.example.env](../examples/firebase/firebase.client.example.env) into `apps/panel/.env` and fill in:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_BASE_URL`

## 3. Configure the API

Copy [examples/firebase/firebase.server.example.env](../examples/firebase/firebase.server.example.env) into `apps/api/.env` and fill in:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `PANEL_ORIGIN`

Use the service account JSON from Firebase Project Settings > Service Accounts.

## 4. Seed default data

```bash
cd apps/api
$env:ADMIN_UID="your-firebase-uid"
$env:ADMIN_EMAIL="owner@example.com"
pnpm seed
```

## 5. Firestore rules

Use [examples/firebase/firestore.rules.example](../examples/firebase/firestore.rules.example) as a starting point. The production panel still relies on API-side authorization, so Firestore client access should stay narrow.

For Phase 3 collections such as `apiKeys`, `backupTargets`, `webhooks`, `webhookDeliveries`, `jobs`, `alertRules`, `alertEvents`, `domainMappings`, and `firewallRules`, prefer API-only writes through the Firebase Admin SDK. Do not grant broad client write access to collections that contain secrets, operational commands, or audit-sensitive records.

## 6. Notes

- Mock auth and mock data are only for local development.
- Do not expose the Firebase Admin private key to the panel.
- The panel uses Firebase Auth; the API verifies the Firebase ID token on every request.
