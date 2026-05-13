import { buildApp } from "./app.js";
import { config } from "./config.js";
import { bootstrapAdminUser } from "./lib/bootstrap.js";

const start = async () => {
  await bootstrapAdminUser();
  const app = await buildApp();
  await app.listen({
    port: config.PORT,
    host: config.HOST,
  });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
