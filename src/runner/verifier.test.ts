import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { parseProject } from '../model/project.js';
import { createBaseline, digest, verifyContract } from './verifier.js';

async function setup(
	t: TestContext,
	script = "require('node:fs').writeFileSync('actual.txt','approved');",
) {
	const target = await mkdtemp(join(tmpdir(), 'tale-verifier-'));
	t.after(() => rm(target, { recursive: true, force: true }));
	const project = parseProject(await readFile('tale.project.json', 'utf8'));
	const output = project.diagram.items.find(
		(item) => item.id === 'deployment-bytes',
	);
	const absent = project.diagram.items.find(
		(item) => item.id === 'no-project-json',
	);
	const unchanged = project.diagram.items.find(
		(item) => item.id === 'preserve-project',
	);
	const check = project.diagram.items.find(
		(item) => item.id === 'deploy-check',
	);
	assert.ok(output && absent && unchanged && check);
	output.properties.subject = 'actual.txt';
	output.properties.expected = 'expected.txt';
	absent.properties.subject = 'wrong.json';
	unchanged.properties.subject = 'keep.txt';
	check.properties.arguments = ['adapter.cjs'];
	check.properties.protected_files = ['adapter.cjs'];
	await writeFile(join(target, 'adapter.cjs'), script);
	await writeFile(join(target, 'expected.txt'), 'approved');
	await writeFile(join(target, 'keep.txt'), 'untouched');
	const baseline = await createBaseline(target, project, 'Approved test');
	return {
		target,
		project,
		baseline,
		pin: digest(JSON.stringify(baseline)),
		check,
		output,
	};
}
test('runner verifies the real command output and preserves independent byte expectations', async (t) => {
	const f = await setup(t);
	const result = await verifyContract(f.target, f.project, f.baseline, f.pin);
	assert.equal(result.passed, true);
	assert.ok(result.requirements.every((entry) => entry.passed));
	const again = await verifyContract(f.target, f.project, f.baseline, f.pin);
	assert.deepEqual(again, result);
});
test('a successful command producing JSON instead of the required artifact fails', async (t) => {
	const f = await setup(
		t,
		"require('node:fs').writeFileSync('wrong.json','{}');",
	);
	const result = await verifyContract(f.target, f.project, f.baseline, f.pin);
	assert.equal(result.checks[0]?.passed, true);
	assert.equal(result.passed, false);
	assert.equal(
		result.requirements.find((entry) => entry.id === 'deployment-bytes')
			?.passed,
		false,
	);
	assert.equal(
		result.requirements.find((entry) => entry.id === 'no-project-json')?.passed,
		false,
	);
});
test('modified proof or reference files block execution before the adapter starts', async (t) => {
	const f = await setup(t);
	await writeFile(
		join(f.target, 'adapter.cjs'),
		"throw new Error('Changed test');",
	);
	await assert.rejects(
		verifyContract(f.target, f.project, f.baseline, f.pin),
		/Approved test or reference changed/,
	);
	await assert.rejects(readFile(join(f.target, 'actual.txt')), /ENOENT/);
});
test('changing the contract and its baseline together cannot bypass the trusted digest', async (t) => {
	const f = await setup(t);
	f.output.properties.condition = 'exists';
	await assert.rejects(
		verifyContract(f.target, f.project, f.baseline, f.pin),
		/Agreement changed/,
	);
	const replacement = await createBaseline(
		f.target,
		f.project,
		'Unapproved rewrite',
	);
	await assert.rejects(
		verifyContract(f.target, f.project, replacement, f.pin),
		/digest does not match/,
	);
});
test('commands cannot edit approved expectations and still pass', async (t) => {
	const f = await setup(
		t,
		"require('node:fs').writeFileSync('expected.txt','changed');",
	);
	await assert.rejects(
		verifyContract(f.target, f.project, f.baseline, f.pin),
		/Approved test or reference changed/,
	);
});
test('nonzero exits, changed protected subjects, and timeouts fail verification', async (t) => {
	const f = await setup(
		t,
		"require('node:fs').writeFileSync('keep.txt','changed');process.exitCode=1;",
	);
	assert.equal(
		(await verifyContract(f.target, f.project, f.baseline, f.pin)).passed,
		false,
	);
	const timed = await setup(t, 'setInterval(()=>{},1000);');
	const timeoutMs = 50;
	timed.check.properties.timeout_ms = timeoutMs;
	const baseline = await createBaseline(
		timed.target,
		timed.project,
		'Timeout test',
	);
	assert.equal(
		(
			await verifyContract(
				timed.target,
				timed.project,
				baseline,
				digest(JSON.stringify(baseline)),
			)
		).passed,
		false,
	);
});

test('exit zero cannot hide changes to a file required to remain unchanged', async (t) => {
	const f = await setup(
		t,
		"const fs=require('node:fs');fs.writeFileSync('actual.txt','approved');fs.writeFileSync('keep.txt','changed');",
	);
	const result = await verifyContract(f.target, f.project, f.baseline, f.pin);
	assert.equal(result.checks[0]?.passed, true);
	assert.equal(
		result.requirements.find((entry) => entry.id === 'preserve-project')
			?.passed,
		false,
	);
	assert.equal(result.passed, false);
});
