import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  renameSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

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
const electron = require("electron");
const executable =
  process.platform === "darwin" ? brandedMacExecutable(electron) : electron;
const child = spawn(executable, ["."], { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

function command(executable, args) {
  const result = spawnSync(executable, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function brandedMacExecutable(electronExecutable) {
  const source = resolve(dirname(electronExecutable), "../..");
  const bundle = resolve("dist/Tale.app");
  const contents = join(bundle, "Contents");
  const originalExecutable = join(contents, "MacOS/Electron");
  const taleExecutable = join(contents, "MacOS/Tale");
  const plist = join(contents, "Info.plist");
  command("/bin/cp", ["-cR", source, bundle]);
  renameSync(originalExecutable, taleExecutable);
  copyFileSync(
    "src/resources/tale_electron_icons/tale.icns",
    join(contents, "Resources/tale.icns"),
  );
  const values = {
    CFBundleDisplayName: "Tale",
    CFBundleExecutable: "Tale",
    CFBundleIconFile: "tale.icns",
    CFBundleIdentifier: "com.tale.app",
    CFBundleName: "Tale",
  };
  for (const [key, value] of Object.entries(values))
    command("/usr/bin/plutil", ["-replace", key, "-string", value, plist]);
  command("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", bundle]);
  return taleExecutable;
}
