import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
rmSync("dist", { recursive: true, force: true });
for (const config of ["tsconfig.json", "tsconfig.browser.json"]) {
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(require.resolve("typescript/package.json")), "bin/tsc"),
      "-p",
      config,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
mkdirSync("dist/browser/ui", { recursive: true });
for (const file of ["index.html", "styles.css"])
  cpSync(`src/ui/${file}`, `dist/browser/ui/${file}`);
