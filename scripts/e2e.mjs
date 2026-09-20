import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
for (let build = 1; build <= 2; build++) {
  console.log(`Clean build ${build}/2`);
  const compiled = spawnSync(process.execPath, ["scripts/build.mjs"], {
    stdio: "inherit",
  });
  if (compiled.status !== 0) process.exit(compiled.status ?? 1);
  const result = spawnSync(
    require("electron"),
    ["dist/node/tests/electron.e2e.test.js"],
    {
      stdio: "inherit",
      timeout: 120000,
      env: { ...env, TALE_BUILD_RUN: String(build) },
    },
  );
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
