import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
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

// Browsers consume the same JSON catalogue as a data-only ES module.
const catalogue = JSON.parse(readFileSync("src/model/catalogue.json", "utf8"));
writeFileSync("dist/browser/model/catalogue-data.js", `export default ${JSON.stringify(catalogue)};\n`);
const catalogueModule = "dist/browser/model/catalogue.js";
writeFileSync(catalogueModule, readFileSync(catalogueModule, "utf8").replace("'./catalogue.json'", "'./catalogue-data.js'"));
