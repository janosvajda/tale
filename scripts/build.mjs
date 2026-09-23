import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
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

// The Chrome extension uses the same compiled browser modules and UI. Only its
// manifest, launcher and browser file adapter are platform-specific.
cpSync("dist/browser", "dist/chrome", { recursive: true });
mkdirSync("dist/chrome/resources/tale_electron_icons", { recursive: true });
for (const size of [16, 32, 48, 128])
  cpSync(
    `src/resources/tale_electron_icons/tale-${size}.png`,
    `dist/chrome/resources/tale_electron_icons/tale-${size}.png`,
  );
mkdirSync("dist/chrome/templates", { recursive: true });
const manifest = JSON.parse(readFileSync("src/chrome/manifest.json", "utf8"));
manifest.version = JSON.parse(readFileSync("package.json", "utf8")).version;
writeFileSync(
  "dist/chrome/manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);
cpSync("src/chrome/service-worker.js", "dist/chrome/service-worker.js");
const chromeHtml = "dist/chrome/ui/index.html";
writeFileSync(
  chromeHtml,
  readFileSync(chromeHtml, "utf8").replaceAll("../../resources/", "../resources/"),
);
const templates = readdirSync("templates")
  .filter((name) => name.endsWith(".json"))
  .map((id) => ({
    id,
    name: JSON.parse(readFileSync(`templates/${id}`, "utf8")).name,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
for (const template of templates)
  cpSync(`templates/${template.id}`, `dist/chrome/templates/${template.id}`);
writeFileSync(
  "dist/chrome/templates/index.json",
  `${JSON.stringify(templates, null, 2)}\n`,
);
function removeChromeDevelopmentFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) removeChromeDevelopmentFiles(path);
    else if (entry.name.endsWith(".map") || entry.name.endsWith(".test.js"))
      rmSync(path);
  }
}
removeChromeDevelopmentFiles("dist/chrome");
