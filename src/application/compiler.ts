import { contractFor } from '../model/contract.js';
import {
	check,
	type DiagramItem,
	type ItemSection,
	type Json,
	type Project,
	record,
	validateProject,
} from '../model/project.js';
import { directives } from '../model/tags.js';

export interface Artifact {
	path: string;
	content: string;
}
function word(value: string): string {
	const simple =
		value.length > 0 && [...value].every((c) => !' \t\n\r"\\'.includes(c));
	return simple ? value : JSON.stringify(value);
}
function name(value: string): string {
	check(
		value.length > 0 &&
			[...value].every((c) =>
				'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_+.-'.includes(
					c,
				),
			),
		`Invalid directive: ${value}`,
	);
	return value;
}
function scalar(value: Json): string {
	if (typeof value === 'string') return word(value);
	if (value === null || typeof value === 'boolean' || typeof value === 'number')
		return String(value);
	if (Array.isArray(value)) return value.map(scalar).join(' ');
	return Object.keys(value)
		.sort()
		.map((k) => `${name(k)}=${scalar(value[k] ?? null)}`)
		.join(' ');
}
function steps(value: Json | undefined, depth = 1): string[] {
	check(Array.isArray(value), 'Steps must be an array');
	return value.flatMap((step) => {
		check(
			record(step) && typeof step.operation === 'string',
			'Each step needs an operation',
		);
		const prefix = '  '.repeat(depth);
		if (step.operation === 'run') {
			check(
				typeof step.command === 'string' &&
					record(step.expect) &&
					typeof step.expect.exit === 'number',
				'Run requires command and expected exit',
			);
			check(
				Object.keys(step).every((k) =>
					['operation', 'command', 'expect', 'when'].includes(k),
				),
				'Unsupported run field',
			);
			check(Object.keys(step.expect).length === 1, 'Unsupported expectation');
			return [
				`${prefix}run ${JSON.stringify(step.command)} expect exit=${step.expect.exit}${step.when ? ` when=${word(String(step.when))}` : ''}`,
			];
		}
		if (step.operation === 'review') {
			check(
				Array.isArray(step.checks) &&
					Object.keys(step).every((k) => ['operation', 'checks'].includes(k)),
				'Invalid review step',
			);
			return [`${prefix}review ${scalar(step.checks as Json[])}`];
		}
		if (step.operation === 'stop') {
			check(
				typeof step.when === 'string' &&
					Object.keys(step).every((k) => ['operation', 'when'].includes(k)),
				'Invalid stop step',
			);
			return [`${prefix}stop ${word(step.when)}`];
		}
		return genericStep(step, depth, prefix);
	});
}
function genericStep(
	step: Record<string, unknown>,
	depth: number,
	prefix: string,
): string[] {
	// Task directives use an explicit argument list, attribute map and child steps.
	check(
		Object.keys(step).every((k) =>
			['operation', 'args', 'attributes', 'children'].includes(k),
		),
		'Unsupported step fields',
	);
	check(
		step.args === undefined || Array.isArray(step.args),
		'Step args must be an array',
	);
	check(
		step.attributes === undefined || record(step.attributes),
		'Step attributes must be an object',
	);
	const args = (step.args as Json[] | undefined)
		?.map((arg) =>
			typeof arg === 'string' ? JSON.stringify(arg) : scalar(arg),
		)
		.join(' ');
	const attrs = step.attributes ? scalar(step.attributes as Json) : '';
	const line = `${prefix}${name(String(step.operation))}${args ? ` ${args}` : ''}${attrs ? ` ${attrs}` : ''}`;
	return [
		line,
		...(step.children ? steps(step.children as Json, depth + 1) : []),
	];
}

function section(tag: string, item: DiagramItem): string[] {
	const p = item.properties;
	if (tag === 'GOAL') {
		check(
			(typeof p.text === 'string' && Object.keys(p).length === 1) ||
				(Object.keys(p).length === 0 && (item.sections?.length ?? 0) > 0),
			'GOAL requires only text',
		);
		return [
			tag,
			...String(p.text ?? '')
				.split('\n')
				.map((line) => `  ${line.replaceAll('\r', '')}`),
		];
	}
	if (tag === 'SCOPE') {
		check(
			['allow', 'deny', 'require_approval'].includes(String(p.mode)) &&
				Array.isArray(p.paths),
			'Invalid SCOPE',
		);
		check(
			Object.keys(p).every((k) => ['mode', 'paths'].includes(k)),
			'Unsupported SCOPE property',
		);
		return [
			`SCOPE ${p.mode}`,
			...p.paths.map((path) => {
				check(typeof path === 'string', 'Invalid scope path');
				return `  ${word(path)}`;
			}),
		];
	}
	if (['PLAN', 'PROOF', 'OVERRIDES'].includes(tag)) {
		check(Object.keys(p).length === 1 && 'steps' in p, `${tag} requires steps`);
		return [tag, ...steps(p.steps)];
	}
	const order = directives[tag];
	if (!order)
		return [
			tag,
			...Object.keys(p)
				.sort()
				.map((key) => `  ${name(key)} ${scalar(p[key] ?? null)}`.trimEnd()),
		];
	check(
		Object.keys(p).every((k) => order.includes(k)),
		`Unsupported property in ${tag}`,
	);
	return [
		tag,
		...order
			.filter((k) => k in p)
			.flatMap((k) => {
				if (k === 'canonicalize') {
					check(Array.isArray(p[k]), 'canonicalize requires a list');
					return ['  canonicalize', ...p[k].map((v) => `    - ${scalar(v)}`)];
				}
				return [`  ${k} ${scalar(p[k] ?? null)}`.trimEnd()];
			}),
	];
}
function customSections(sections: ItemSection[] = []): string[] {
	return sections.flatMap((section) => [
		`  section ${JSON.stringify(section.title)} type=${section.type}`,
		section.type === 'text'
			? `    text ${JSON.stringify(section.text.replaceAll('\r\n', '\n').replaceAll('\r', '\n'))}`
			: `    selected${section.options
					.filter((option) => option.selected)
					.map((option) => ` ${JSON.stringify(option.label)}`)
					.join('')}`,
	]);
}
export function compile(project: Project): Artifact[] {
	validateProject(project);
	const contract = contractFor(project);
	const items = new Map(project.diagram.items.map((i) => [i.id, i]));
	const types = new Map(project.itemTypes.map((t) => [t.id, t.tag]));
	const paths = new Set<string>();
	return [...project.exports]
		.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
		.map((output) => {
			check(!paths.has(output.path), `Duplicate output: ${output.path}`);
			paths.add(output.path);
			const root = items.get(output.rootItemId);
			check(
				root &&
					types.get(root.typeId) === 'TALE' &&
					root.properties.version === 'v0',
				'Export must point to a TALE v0 item',
			);
			check(
				Object.keys(root.properties).length === 1,
				'Unsupported TALE property',
			);
			const edges = project.diagram.connections
				.filter((e) => e.from === root.id)
				.sort((a, b) => a.order - b.order);
			check(
				new Set(edges.map((e) => e.order)).size === edges.length,
				'Duplicate section order',
			);
			const seen = new Set<string>();
			const sections: { tag: string; item: DiagramItem }[] = [];
			for (const edge of edges) {
				check(
					edge.kind === 'contains',
					`Undefined compilation for ${edge.kind} connections`,
				);
				const child = items.get(edge.to);
				check(
					child && child.id !== root.id && !seen.has(child.id),
					'Cyclic or repeated section reference',
				);
				seen.add(child.id);
				check(
					!project.diagram.connections.some(
						(e) => e.from === child.id && e.kind !== 'verified_by',
					),
					'Nested/flow connections can be saved, but have no defined Tale compilation yet',
				);
				const tag = types.get(child.typeId);
				check(tag && tag !== 'TALE', 'Unsupported section type');
				sections.push({ tag, item: child });
			}
			const present = sections.map((s) => s.tag);
			for (const required of ['META', 'GOAL', 'SCOPE', 'PROOF'])
				check(present.includes(required), `Missing ${required}`);
			check(
				present.filter((t) => t === 'META').length === 1,
				'Exactly one META is required',
			);
			const meta = sections.find((s) => s.tag === 'META');
			check(meta?.item.properties.ID, 'META needs an ID');
			if (meta?.item.properties.TYPE !== 'project')
				check(present.includes('PLAN'), 'Task Tale requires PLAN');
			const body = sections.map((s) =>
				[
					...section(
						s.tag,
						s.tag === 'REQUIREMENT' || s.tag === 'CHECK'
							? {
									...s.item,
									properties: {
										...s.item.properties,
										id: s.item.id,
										...(s.tag === 'REQUIREMENT'
											? {
													verified_by:
														contract.requirements.find(
															(r) => r.id === s.item.id,
														)?.checks ?? [],
												}
											: {}),
									},
								}
							: s.item,
					),
					...customSections(s.item.sections),
				].join('\n'),
			);
			const rootSections = customSections(root.sections);
			return {
				path: output.path,
				content: `TALE v0\n${rootSections.length ? `${rootSections.join('\n')}\n\n` : ''}${body.join('\n\n')}\n`,
			};
		});
}
