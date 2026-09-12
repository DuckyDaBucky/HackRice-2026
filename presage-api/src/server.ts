import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { nativeRuntime } from "./sdk/native-runtime.js";

if (existsSync(".env")) loadEnvFile(".env");

const config = loadConfig();
const app = await buildApp({ config, runtime: nativeRuntime });

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ err: error }, "shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, "server failed to start");
  process.exitCode = 1;
}
