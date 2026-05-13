import { store } from "./store.js";

export const bootstrapAdminUser = async () => {
  const bootstrapEnabled =
    process.env.BOOTSTRAP_ADMIN_ON_START === "true" ||
    Boolean(
      process.env.ADMIN_USERNAME &&
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD,
    );

  if (!bootstrapEnabled) {
    return;
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminEmail || !adminPassword) {
    return;
  }

  await store
    .createLocalUser({
      username: adminUsername,
      email: adminEmail,
      password: adminPassword,
      roleIds: ["admin"],
      displayName: adminUsername,
    })
    .catch(() => undefined);
};
