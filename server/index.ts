import { buildApp } from "./app";
import { loadConfig } from "./config";
const config = loadConfig();
const app = buildApp({ config });
app
  .listen({ host: "0.0.0.0", port: config.PORT })
  .then(() =>
    console.log(
      `DripGram backend listening on port ${config.PORT}; model ${config.META_MODEL}; Standard mode. No credentials are logged.`,
    ),
  )
  .catch(() => {
    console.error(
      "Backend could not start. Check the port and environment configuration.",
    );
    process.exitCode = 1;
  });
