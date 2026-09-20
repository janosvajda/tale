import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function missingTestPairs(root) {
  const missing = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git', 'artifacts'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const pair = `${path.slice(0, -3)}.test.ts`;
        try {
          if (!(await stat(pair)).isFile()) missing.push(relative(root, pair));
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          missing.push(relative(root, pair));
        }
      }
    }
  }
  await visit(root);
  return missing.sort();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const missing = await missingTestPairs(process.cwd());
  if (missing.length) {
    console.error(`Missing paired tests:\n${missing.map(path => `  ${path}`).join('\n')}`);
    process.exitCode = 1;
  } else console.log('Every TypeScript source file has a sibling .test.ts file.');
}
