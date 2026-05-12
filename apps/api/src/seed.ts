import { store } from "./lib/store.js";

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

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminUsername && adminEmail && adminPassword) {
    await store
      .createLocalUser({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        roleIds: ["admin"],
        displayName: adminUsername,
      })
      .catch(() => undefined);
  }

  console.log("Seed complete.");
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
