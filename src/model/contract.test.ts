import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compile } from '../application/compiler.js';
import { contractFor, inspectContract, relativeFile } from './contract.js';
import { parseProject } from './project.js';

test('requirements link to checks in the compiled Tale; board positions are not contract semantics', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const contract = contractFor(project);
	assert.ok(
		contract.requirements.every((entry) =>
			entry.checks.includes('deploy-check'),
		),
	);
	const before = compile(project);
	project.diagram.items.reverse();
	project.diagram.viewport.x += 1;
	assert.deepEqual(compile(project), before);
	project.diagram.connections = project.diagram.connections.filter(
		(edge) => edge.from !== 'deployment-bytes' || edge.kind !== 'verified_by',
	);
	assert.ok(
		inspectContract(project).issues.some((issue) =>
			issue.message.includes('no linked check'),
		),
	);
	assert.throws(() => compile(project), /no linked check/);
});
test('contradictory conditions and wrong action links block compilation', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const wrong = project.diagram.items.find(
		(item) => item.id === 'no-project-json',
	);
	assert.ok(wrong);
	wrong.properties.subject = 'artifacts/contract-deployment/.tale/project.tale';
	assert.throws(() => compile(project), /both absent and present/);
	wrong.properties.action = 'another action';
	assert.throws(() => compile(project), /same action/);
});
test('paths and incomplete executable contracts fail closed, while JSON can save drafts', async () => {
	for (const path of [
		'/absolute',
		'../outside',
		'a/../b',
		'C:/x',
		'a\\b',
		'a//b',
		'a\0b',
	])
		assert.equal(relativeFile(path), false);
	assert.equal(relativeFile('reports/output.txt'), true);
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const check = project.diagram.items.find(
		(item) => item.id === 'deploy-check',
	);
	assert.ok(check);
	check.properties.protected_files = [];
	assert.ok(inspectContract(project).issues.length);
	assert.throws(() => compile(project), /protect/);
	parseProject(JSON.stringify(project));
});

test('proof policy cannot select self-approval and overrides remain explicit change requests', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const proof = project.diagram.items.find((item) => item.id === 'proof');
	assert.ok(proof);
	proof.properties.steps = [
		{
			operation: 'contract_verify',
			attributes: { baseline: 'project', coverage: 'mandatory' },
		},
	];
	assert.throws(() => compile(project), /external baseline/);
	proof.properties.steps = [
		{
			operation: 'contract_verify',
			attributes: { baseline: 'external', coverage: 'mandatory' },
		},
	];
	project.diagram.items.push({
		id: 'change-request',
		typeId: 'overrides',
		title: 'Request change',
		shape: 'rectangle',
		position: { x: 0, y: 0 },
		size: { width: 320, height: 180 },
		properties: {
			steps: [
				{
					operation: 'request_change',
					attributes: { requirement: 'missing', reason: 'New format' },
				},
			],
		},
	});
	project.diagram.connections.push({
		id: 'root-change',
		from: 'project',
		to: 'change-request',
		kind: 'contains',
		order: project.diagram.connections.length,
	});
	assert.throws(() => compile(project), /existing requirement/);
	const item = project.diagram.items.at(-1);
	assert.ok(item);
	item.properties.steps = [
		{
			operation: 'request_change',
			attributes: { requirement: 'deployment-bytes', reason: 'New format' },
		},
	];
	assert.ok(
		compile(project)[0]?.content.includes(
			'request_change reason="New format" requirement=deployment-bytes',
		),
	);
});
