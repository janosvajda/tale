import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { check, parseProject } from '../model/project.js';
import { type Baseline, verifyContract } from './verifier.js';

const argumentCount = 5;
export async function run(args: string[]): Promise<number> {
	const [command, projectPath, targetPath, baselinePath, pin] = args;
	check(
		command === 'verify' &&
			args.length === argumentCount &&
			projectPath &&
			targetPath &&
			baselinePath &&
			pin,
		'Usage: node dist/node/src/runner/cli.js verify <project.json> <target> <external-baseline.json> <trusted-sha256>',
	);
	const target = await realpath(resolve(targetPath));
	const approved = await realpath(resolve(baselinePath));
	const rel = relative(target, approved);
	check(
		rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel),
		'Keep the trusted baseline outside the target project',
	);
	const source = await readFile(projectPath, 'utf8');
	const project = parseProject(source);
	const baseline: Baseline = JSON.parse(await readFile(approved, 'utf8'));
	const result = await verifyContract(target, project, baseline, pin);
	check(
		(await readFile(projectPath, 'utf8')) === source,
		'Project changed during verification',
	);
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	return result.passed ? 0 : 1;
}
if (require.main === module) {
	void run(process.argv.slice(2))
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}
