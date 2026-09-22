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
cpSync("src/resources/tale_electron_icons", "dist/resources/tale_electron_icons", {
  recursive: true,
});

// Browsers consume the same JSON catalogues as data-only ES modules.
for (const name of ["catalogue", "skills"]) {
  const data = JSON.parse(readFileSync(`src/model/${name}.json`, "utf8"));
  writeFileSync(
    `dist/browser/model/${name}-data.js`,
    `export default ${JSON.stringify(data)};\n`,
  );
  const module = `dist/browser/model/${name}.js`;
  writeFileSync(
    module,
    readFileSync(module, "utf8").replace(
      `'./${name}.json'`,
      `'./${name}-data.js'`,
    ),
  );
}
