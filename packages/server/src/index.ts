import "dotenv/config";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp();

  await app.listen({ port: Number(env.PORT), host: "0.0.0.0" });
  app.log.info(`Server running on port ${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
