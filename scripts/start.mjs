import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
if (!existsSync("node_modules/electron/dist")) {
  const install = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["ci"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (install.status !== 0) process.exit(install.status ?? 1);
}
const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require("electron"), ["."], { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
