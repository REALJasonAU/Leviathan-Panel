import { store } from "./lib/store.js";

const seed = async () => {
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
