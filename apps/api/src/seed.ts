import { firestore } from "./lib/firebase.js";
import { store } from "./lib/store.js";
import { nowIso } from "./lib/utils.js";

const seed = async () => {
  await store
    .createRole({
      id: "support",
      name: "Support",
      permissions: [
        "dashboard.view",
        "servers.view",
        "servers.console.view",
        "servers.console.command",
        "servers.files.view",
        "servers.backups.view",
        "servers.schedules.view",
        "audit.view",
      ],
    })
    .catch(() => undefined);

  await store
    .createTemplate({
      id: "tpl_node_app",
      name: "Node App",
      category: "docker",
      description: "Generic Node.js container template.",
      dockerImages: ["node:20-alpine"],
      startupCommand: "npm start",
      environmentDefinitions: [
        {
          key: "PORT",
          displayName: "Port",
          defaultValue: "3000",
          required: true,
          secret: false,
          readonly: false,
          allowedValues: [],
        },
      ],
      importedEnvExample: "PORT=3000\n",
    })
    .catch(() => undefined);

  await store.updateSettings({
    appName: "Leviathan",
  });

  const adminUid = process.env.ADMIN_UID;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminUid) {
    await firestore
      .collection("users")
      .doc(adminUid)
      .set(
        {
          uid: adminUid,
          email: adminEmail,
          displayName: adminEmail ?? "Initial Admin",
          roleIds: ["admin"],
          serverIds: [],
          twoFactorRequired: false,
          disabled: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
  }

  console.log("Seed complete.");
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
