// Approved adapter: exercise the application's actual deployment, without asserting its own output.
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareDeployment, commitDeployment } from '../dist/node/src/main/deployment.js';
import { parseProject } from '../dist/node/src/model/project.js';

const target = resolve('artifacts/contract-deployment');
await rm(target, {recursive: true, force: true});
await mkdir(target, {recursive: true});
const project = parseProject(await readFile('tale.project.json', 'utf8'));
const plan = await prepareDeployment(target, project, [{agent:'codex',location:'auto'}]);
await commitDeployment(plan, false);
