import {
	definition,
	type FieldDefinition,
	itemDefinition,
	itemRole,
	type StepDefinition,
	type StepField,
	type TagDefinition,
} from '../model/catalogue.js';
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
function validateStepField(field: StepField, value: unknown) {
	check(!field.required || value !== undefined, `Step requires ${field.key}`);
	if (value === undefined) return;
	const kind = Array.isArray(value)
		? 'array'
		: value === null
			? 'null'
			: typeof value;
	check(
		!field.valueType || kind === field.valueType,
		`Invalid step ${field.key}`,
	);
	if (field.properties) {
		check(record(value), `Invalid step ${field.key}`);
		check(
			Object.keys(value).length === Object.keys(field.properties).length,
			`Unsupported step ${field.key} property`,
		);
		for (const [key, type] of Object.entries(field.properties))
			check(typeof value[key] === type, `Invalid step ${field.key}.${key}`);
	}
}
function steps(
	value: Json | undefined,
	formats: Record<string, StepDefinition>,
	depth = 1,
): string[] {
	check(Array.isArray(value), 'Steps must be an array');
	return value.flatMap((step) => {
		check(
			record(step) && typeof step.operation === 'string',
			'Each step needs an operation',
		);
		const prefix = '  '.repeat(depth);
		const fields = formats[step.operation]?.fields;
		if (!fields) return genericStep(step, depth, prefix, formats);
		check(
			Object.keys(step).every(
				(key) =>
					key === 'operation' || fields.some((field) => field.key === key),
			),
			'Unsupported step field',
		);
		const parts = fields.flatMap((field) => {
			const value = step[field.key];
			validateStepField(field, value);
			if (value === undefined) return [];
			return [
				(field.prefix ?? '') +
					(field.quote ? JSON.stringify(value) : scalar(value as Json)),
			];
		});
		return [`${prefix}${name(step.operation)} ${parts.join(' ')}`.trimEnd()];
	});
}
function genericStep(
	step: Record<string, unknown>,
	depth: number,
	prefix: string,
	formats: Record<string, StepDefinition>,
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
		...(step.children ? steps(step.children as Json, formats, depth + 1) : []),
	];
}

function fieldLines(
	field: FieldDefinition,
	value: Json,
	spec: TagDefinition,
): string[] {
	switch (field.format) {
		case 'header':
			return [];
		case 'lines':
			check(typeof value === 'string', `${field.key} requires text`);
			return value
				.replaceAll('\r', '')
				.split('\n')
				.map((line) => `  ${line}`);
		case 'values':
			check(
				Array.isArray(value) &&
					value.every((entry) => typeof entry === 'string'),
				`${field.key} requires text entries`,
			);
			return value.map((entry) => `  ${scalar(entry)}`);
		case 'bullets':
			check(Array.isArray(value), `${field.key} requires a list`);
			return [
				`  ${name(field.key)}`,
				...value.map((entry) => `    - ${scalar(entry)}`),
			];
		case 'steps':
			return steps(value, spec.steps ?? {});
		default:
			return [`  ${name(field.key)} ${scalar(value)}`.trimEnd()];
	}
}
function validateField(field: FieldDefinition, item: DiagramItem) {
	const value = item.properties[field.key];
	const absent = value === undefined || value === '';
	check(
		!field.required ||
			!absent ||
			(field.allowSections && item.sections?.length),
		`Missing ${field.key}`,
	);
	if (value === undefined) return;
	check(
		field.equals === undefined ||
			JSON.stringify(value) === JSON.stringify(field.equals),
		`Invalid ${field.key}`,
	);
	check(!field.enum || field.enum.includes(value), `Invalid ${field.key}`);
	check(
		!field.valueType ||
			(field.valueType === 'array'
				? Array.isArray(value)
				: typeof value === field.valueType),
		`Invalid ${field.key}`,
	);
}
function section(
	tag: string,
	item: DiagramItem,
	spec: TagDefinition,
): string[] {
	const fields = spec.fields ?? [];
	const keys = fields.map((field) => field.key);
	const extras = Object.keys(item.properties)
		.filter((key) => !keys.includes(key))
		.sort();
	check(
		spec.additionalProperties !== false || !extras.length,
		`Unsupported property in ${tag}`,
	);
	for (const field of fields) validateField(field, item);
	const header = fields
		.filter(
			(field) => field.format === 'header' && field.key in item.properties,
		)
		.map((field) => scalar(item.properties[field.key] ?? null));
	return [
		[tag, ...header].join(' '),
		...fields
			.filter((field) => field.key in item.properties)
			.flatMap((field) =>
				fieldLines(field, item.properties[field.key] ?? null, spec),
			),
		...extras.flatMap((key) =>
			fieldLines({ key }, item.properties[key] ?? null, spec),
		),
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
function children(project: Project, root: DiagramItem): DiagramItem[] {
	const edges = project.diagram.connections
		.filter((edge) => edge.from === root.id)
		.sort((a, b) => a.order - b.order);
	check(
		new Set(edges.map((edge) => edge.order)).size === edges.length,
		'Duplicate section order',
	);
	const seen = new Set<string>();
	return edges.map((edge) => {
		check(
			edge.kind === 'contains',
			`Undefined compilation for ${edge.kind} connections`,
		);
		const child = project.diagram.items.find((item) => item.id === edge.to);
		check(
			child && child.id !== root.id && !seen.has(child.id),
			'Cyclic or repeated section reference',
		);
		seen.add(child.id);
		check(
			!project.diagram.connections.some(
				(edge) => edge.from === child.id && edge.kind !== 'verified_by',
			),
			'Nested/flow connections can be saved, but have no defined Tale compilation yet',
		);
		check(
			itemRole(project, child) !== 'document',
			'A document cannot contain another document',
		);
		return child;
	});
}
function validateRequiredTags(
	project: Project,
	root: DiagramItem,
	children: DiagramItem[],
) {
	const tagged = children.map((item) => ({
		item,
		tag: project.itemTypes.find((type) => type.id === item.typeId)?.tag,
	}));
	for (const requirement of itemDefinition(project, root).requiredTags ?? []) {
		if (
			requirement.when &&
			tagged.find((entry) => entry.tag === requirement.when?.tag)?.item
				.properties[requirement.when.key] === requirement.when.notEquals
		)
			continue;
		const count = tagged.filter(
			(entry) => entry.tag === requirement.tag,
		).length;
		check(count >= requirement.min, `Missing ${requirement.tag}`);
		check(
			requirement.max === undefined || count <= requirement.max,
			`Too many ${requirement.tag} tags`,
		);
	}
}
export function compile(project: Project): Artifact[] {
	validateProject(project);
	check(
		project.exports.length <= 1,
		'This project has multiple Tale files configured. Choose one Tale to deploy in Project settings.',
	);
	const roots = project.diagram.items.filter(
		(item) => itemRole(project, item) === 'document',
	);
	check(
		project.exports.length || roots.length <= 1,
		'Choose one Tale to deploy in Project settings.',
	);
	const source =
		project.exports[0] ??
		(roots[0]
			? { rootItemId: roots[0].id, path: '.tale/project.tale' }
			: undefined);
	check(source, 'Add a document tag and connect your tags before deploying');
	const root = project.diagram.items.find(
		(item) => item.id === source.rootItemId,
	);
	check(
		root && itemRole(project, root) === 'document',
		'Choose a document tag for deployment',
	);
	const contract = contractFor(project);
	const sections = children(project, root);
	validateRequiredTags(project, root, sections);
	const render = (item: DiagramItem) => {
		const type = project.itemTypes.find((type) => type.id === item.typeId);
		check(type, 'Missing tag definition');
		const spec = definition(type);
		const properties = { ...item.properties };
		for (const field of spec.fields ?? []) {
			if (field.source === 'id') properties[field.key] = item.id;
			if (field.source === 'links')
				properties[field.key] =
					contract.requirements.find((entry) => entry.id === item.id)?.checks ??
					[];
		}
		return [
			...section(type.tag, { ...item, properties }, spec),
			...customSections(item.sections),
		].join('\n');
	};
	return [
		{
			path: source.path,
			content: `${render(root)}\n${root.sections?.length ? '\n' : ''}${sections.map(render).join('\n\n')}\n`,
		},
	];
}
