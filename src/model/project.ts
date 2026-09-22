export const MAX_PROJECT_BYTES = 8_000_000;
const limits = {
	text: 20000,
	coordinate: 1e8,
	entries: 10000,
	width: 80,
	height: 60,
};

export interface Point {
	x: number;
	y: number;
}
export interface Viewport extends Point {
	zoom: number;
}
export interface Definition {
	id: string;
	kind: 'tag' | 'skill';
	name: string;
	tag: string;
	color: string;
	defaultText: string;
}
export interface DiagramItem {
	id: string;
	definitionId: string;
	title: string;
	text: string;
	position: Point;
	size: { width: number; height: number };
}
export interface Connection {
	id: string;
	from: string;
	to: string;
	order: number;
	label?: string;
	bend?: Point;
}
export interface Project {
	format: 'tale-project';
	formatVersion: 2;
	id: string;
	name: string;
	description: string;
	deploymentDirectory?: string;
	environments: { id: string; name: string }[];
	definitions: Definition[];
	diagram: {
		viewport: Viewport;
		items: DiagramItem[];
		connections: Connection[];
	};
}

export function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
export function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function text(value: unknown, name: string): asserts value is string {
	check(
		typeof value === 'string' &&
			value.trim().length > 0 &&
			value.length <= limits.text,
		`Invalid ${name}`,
	);
}
function prose(value: unknown, name: string): asserts value is string {
	check(
		typeof value === 'string' &&
			value.length <= limits.text &&
			!value.includes('\0'),
		`Invalid ${name}`,
	);
}
function point(value: unknown): asserts value is Point {
	check(record(value), 'Invalid point');
	for (const coordinate of ['x', 'y'])
		check(
			typeof value[coordinate] === 'number' &&
				Number.isFinite(value[coordinate]) &&
				Math.abs(value[coordinate] as number) <= limits.coordinate,
			'Invalid point',
		);
}
function list(
	value: unknown,
	name: string,
): asserts value is Record<string, unknown>[] {
	check(
		Array.isArray(value) &&
			value.length <= limits.entries &&
			value.every(record),
		`Invalid ${name}`,
	);
	const ids = new Set<string>();
	for (const entry of value) {
		text(entry.id, `${name} ID`);
		check(!ids.has(entry.id), `Duplicate ${name} ID`);
		ids.add(entry.id);
	}
}
function connections(value: Record<string, unknown>[], itemIds: Set<unknown>) {
	for (const edge of value) {
		check(
			itemIds.has(edge.from) && itemIds.has(edge.to),
			'Connection references a missing item',
		);
		check(
			Number.isSafeInteger(edge.order) && Number(edge.order) >= 0,
			'Invalid connection order',
		);
		if (edge.bend !== undefined) point(edge.bend);
		if (edge.label !== undefined) prose(edge.label, 'connection label');
	}
}
export function isColor(value: unknown): value is string {
	return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}
export function validateDirectory(value: unknown): asserts value is string {
	text(value, 'deployment directory');
	check(!value.includes('\0'), 'Invalid deployment directory');
}
export function validateProject(value: unknown): asserts value is Project {
	check(record(value), 'Invalid project');
	check(
		JSON.stringify(value).length <= MAX_PROJECT_BYTES,
		'Project exceeds 8 MB',
	);
	check(
		value.format === 'tale-project' && value.formatVersion === 2,
		'Unsupported project format',
	);
	text(value.id, 'project ID');
	text(value.name, 'project name');
	prose(value.description, 'project description');
	if (value.deploymentDirectory !== undefined)
		validateDirectory(value.deploymentDirectory);
	list(value.environments, 'environments');
	for (const environment of value.environments)
		text(environment.name, 'environment name');
	list(value.definitions, 'definitions');
	const names = new Set<string>();
	const tags = new Set<string>();
	for (const definition of value.definitions) {
		check(
			definition.kind === 'tag' || definition.kind === 'skill',
			'Invalid definition kind',
		);
		text(definition.name, 'definition name');
		text(definition.tag, 'Tag name');
		check(/^[A-Z][A-Z0-9_]*$/.test(definition.tag), 'Invalid Tag name');
		check(isColor(definition.color), 'Invalid colour');
		prose(definition.defaultText, 'default text');
		const name = definition.name.trim().toLowerCase();
		check(!names.has(name), 'Tag and Skill names must be unique');
		check(
			definition.kind === 'skill' || !tags.has(definition.tag),
			'Tag names must be unique',
		);
		names.add(name);
		tags.add(definition.tag);
	}
	check(record(value.diagram), 'Missing diagram');
	check(record(value.diagram.viewport), 'Missing viewport');
	point(value.diagram.viewport);
	check(
		typeof value.diagram.viewport.zoom === 'number' &&
			value.diagram.viewport.zoom > 0 &&
			Number.isFinite(value.diagram.viewport.zoom),
		'Invalid zoom',
	);
	list(value.diagram.items, 'items');
	list(value.diagram.connections, 'connections');
	const definitionIds = new Set(value.definitions.map((entry) => entry.id));
	const itemIds = new Set(value.diagram.items.map((entry) => entry.id));
	for (const item of value.diagram.items) {
		check(definitionIds.has(item.definitionId), 'Unknown Tag or Skill');
		text(item.title, 'item title');
		prose(item.text, 'item text');
		point(item.position);
		check(record(item.size), 'Missing item size');
		check(
			typeof item.size.width === 'number' &&
				item.size.width >= limits.width &&
				Number.isFinite(item.size.width),
			'Invalid item width',
		);
		check(
			typeof item.size.height === 'number' &&
				item.size.height >= 60 &&
				Number.isFinite(item.size.height),
			'Invalid item height',
		);
	}
	connections(value.diagram.connections, itemIds);
}
export function parseProject(source: string): Project {
	check(source.length <= MAX_PROJECT_BYTES, 'Project exceeds 8 MB');
	const value: unknown = JSON.parse(source);
	validateProject(value);
	return value;
}
export function serializeProject(project: Project): string {
	validateProject(project);
	return `${JSON.stringify(project, null, 2)}\n`;
}
export function id(): string {
	return crypto.randomUUID();
}
