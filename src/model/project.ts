import { definition, itemRole, type TagDefinition } from './catalogue.js';
import { validTag } from './tags.js';

export const MAX_PROJECT_BYTES = 8_000_000;
const limits = {
	text: 20000,
	coordinate: 1e8,
	entries: 10000,
	colorLength: 7,
	depth: 40,
	width: 80,
	height: 60,
};

export type Json =
	| null
	| boolean
	| number
	| string
	| Json[]
	| { [key: string]: Json };
export interface Point {
	x: number;
	y: number;
}
export interface Viewport extends Point {
	zoom: number;
}
export interface ItemType {
	definition?: TagDefinition;
	id: string;
	label: string;
	tag: string;
	color: string;
}
export interface SectionOption {
	id: string;
	label: string;
	selected: boolean;
}
export type ItemSection = { id: string; title: string } & (
	| { type: 'text'; text: string }
	| { type: 'checkboxes' | 'radio'; options: SectionOption[] }
);
export interface DiagramItem {
	id: string;
	typeId: string;
	title: string;
	shape: 'rectangle';
	position: Point;
	size: { width: number; height: number };
	properties: Record<string, Json>;
	sections?: ItemSection[];
}
export interface Connection {
	id: string;
	from: string;
	to: string;
	kind: string;
	order: number;
	bend?: Point;
}
export interface Project {
	format: 'tale-project';
	formatVersion: 1;
	id: string;
	name: string;
	deploymentDirectory?: string;
	environments: { id: string; name: string }[];
	itemTypes: ItemType[];
	diagram: {
		viewport: Viewport;
		items: DiagramItem[];
		connections: Connection[];
	};
	exports: {
		id: string;
		rootItemId: string;
		environmentId: string | null;
		path: string;
	}[];
}

export function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deploymentRoots(project: Project): string[] {
	if (project.exports.length)
		return project.exports.map((entry) => entry.rootItemId);
	const roots = project.diagram.items.filter(
		(item) => itemRole(project, item) === 'document',
	);
	return roots.length === 1 ? roots.map((item) => item.id) : [];
}
export function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
export function text(value: unknown, name: string): asserts value is string {
	check(
		typeof value === 'string' &&
			value.trim().length > 0 &&
			value.length <= limits.text,
		`Invalid ${name}`,
	);
}
export function number(value: unknown, name: string): asserts value is number {
	check(
		typeof value === 'number' &&
			Number.isFinite(value) &&
			Math.abs(value) <= limits.coordinate,
		`Invalid ${name}`,
	);
}
function point(value: unknown): asserts value is Point {
	check(record(value), 'Invalid point');
	number(value.x, 'x');
	number(value.y, 'y');
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
export function isColor(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length === limits.colorLength &&
		value[0] === '#' &&
		[...value.slice(1)].every((c) => '0123456789abcdefABCDEF'.includes(c))
	);
}
export function validateJson(value: unknown, depth = 0): asserts value is Json {
	check(depth <= limits.depth, 'JSON is nested too deeply');
	if (value === null || typeof value === 'boolean' || typeof value === 'string')
		return;
	if (typeof value === 'number') {
		check(Number.isFinite(value), 'Non-finite value');
		return;
	}
	check(Array.isArray(value) || record(value), 'Invalid JSON value');
	for (const [key, entry] of Object.entries(value)) {
		check(
			!['__proto__', 'constructor', 'prototype'].includes(key),
			'Reserved property name',
		);
		validateJson(entry, depth + 1);
	}
}
export function validateProject(value: unknown): asserts value is Project {
	validateJson(value);
	check(
		JSON.stringify(value).length <= MAX_PROJECT_BYTES,
		'Project exceeds 8 MB',
	);
	check(
		record(value) &&
			value.format === 'tale-project' &&
			value.formatVersion === 1,
		'Unsupported project format',
	);
	text(value.id, 'project ID');
	text(value.name, 'project name');
	if (value.deploymentDirectory !== undefined)
		validateDirectory(value.deploymentDirectory);
	list(value.itemTypes, 'item types');
	list(value.environments, 'environments');
	list(value.exports, 'exports');
	const types = new Set(value.itemTypes.map((t) => t.id));
	const tagByColor = new Map<string, string>();
	const colorByTag = new Map<string, string>();
	for (const t of value.itemTypes) {
		validateDefinition(t.definition);
		text(t.label, 'type label');
		text(t.tag, 'type tag');
		check(
			validTag(t.tag),
			'Tags must start with A–Z and contain only A–Z, 0–9, or underscores',
		);
		check(isColor(t.color), 'Invalid tag colour');
		check(
			!tagByColor.has(t.color) || tagByColor.get(t.color) === t.tag,
			'Different tags need distinct colours',
		);
		check(
			!colorByTag.has(t.tag) || colorByTag.get(t.tag) === t.color,
			'Items for the same tag must share its colour',
		);
		tagByColor.set(t.color, t.tag);
		colorByTag.set(t.tag, t.color);
	}
	for (const env of value.environments) text(env.name, 'environment name');
	check(record(value.diagram), 'Missing diagram');
	const d = value.diagram;
	check(record(d.viewport), 'Missing viewport');
	point(d.viewport);
	number(d.viewport.zoom, 'zoom');
	check(d.viewport.zoom > 0, 'Zoom must be positive');
	list(d.items, 'items');
	list(d.connections, 'connections');
	const ids = new Set(d.items.map((i) => i.id));
	for (const item of d.items) {
		check(types.has(item.typeId), 'Unknown item type');
		text(item.title, 'item title');
		check(item.shape === 'rectangle', 'Unsupported shape');
		point(item.position);
		check(record(item.size), 'Missing item size');
		number(item.size.width, 'width');
		number(item.size.height, 'height');
		check(
			item.size.width >= limits.width && item.size.height >= limits.height,
			'Item is too small',
		);
		check(record(item.properties), 'Invalid item properties');
		validateSections(item.sections);
	}
	for (const edge of d.connections) {
		check(
			ids.has(edge.from) && ids.has(edge.to),
			'Connection references a missing item',
		);
		text(edge.kind, 'connection kind');
		check(
			Number.isSafeInteger(edge.order) && Number(edge.order) >= 0,
			'Invalid connection order',
		);
		if (edge.bend !== undefined) point(edge.bend);
	}
	for (const output of value.exports) {
		check(ids.has(output.rootItemId), 'Export references a missing item');
		check(
			output.environmentId === null ||
				value.environments.some((e) => e.id === output.environmentId),
			'Unknown export environment',
		);
		text(output.path, 'export path');
		check(safeRelativePath(output.path), 'Export path must stay within .tale/');
	}
}
function validateDefinition(value: unknown) {
	if (value === undefined) return;
	check(record(value), 'Invalid tag definition');
	check(
		value.role === undefined ||
			['document', 'requirement', 'check', 'proof', 'override'].includes(
				String(value.role),
			),
		'Invalid tag capability',
	);
	check(
		value.additionalProperties === undefined ||
			typeof value.additionalProperties === 'boolean',
		'Invalid property policy',
	);
	if (value.fields !== undefined) {
		check(Array.isArray(value.fields), 'Invalid tag fields');
		const keys = new Set<string>();
		for (const field of value.fields) {
			validateFieldDefinition(field);
			check(!keys.has(field.key), 'Duplicate tag field');
			keys.add(field.key);
		}
	}
	if (value.initial !== undefined) {
		check(
			record(value.initial) && record(value.initial.properties),
			'Invalid initial tag content',
		);
		validateSections(value.initial.sections);
	}
	if (value.bindings !== undefined)
		check(
			record(value.bindings) &&
				Object.values(value.bindings).every(
					(field) => typeof field === 'string',
				),
			'Invalid verifier bindings',
		);
	validateTagRequirements(value.requiredTags);
	validateStepDefinitions(value.steps);
}
function validateFieldDefinition(
	value: unknown,
): asserts value is import('./catalogue.js').FieldDefinition {
	check(record(value), 'Invalid tag field');
	text(value.key, 'field key');
	if (value.label !== undefined) text(value.label, 'field label');
	check(
		value.format === undefined ||
			['directive', 'header', 'lines', 'values', 'bullets', 'steps'].includes(
				String(value.format),
			),
		'Invalid field format',
	);
	check(
		value.source === undefined ||
			['id', 'links'].includes(String(value.source)),
		'Invalid field source',
	);
	check(
		value.valueType === undefined ||
			['string', 'array'].includes(String(value.valueType)),
		'Invalid field value type',
	);
	check(
		value.choices === undefined ||
			(Array.isArray(value.choices) &&
				value.choices.every((choice) => typeof choice === 'string')),
		'Invalid field choices',
	);
	check(
		value.enum === undefined || Array.isArray(value.enum),
		'Invalid field enum',
	);
	for (const key of ['required', 'allowSections'])
		check(
			value[key] === undefined || typeof value[key] === 'boolean',
			'Invalid field flag',
		);
	if (value.visibleWhen !== undefined) {
		check(record(value.visibleWhen), 'Invalid field visibility');
		text(value.visibleWhen.key, 'visibility field');
	}
}
function validateTagRequirements(value: unknown) {
	if (value === undefined) return;
	check(Array.isArray(value), 'Invalid required tags');
	for (const requirement of value) {
		check(
			record(requirement) &&
				typeof requirement.tag === 'string' &&
				validTag(requirement.tag),
			'Invalid required tag',
		);
		check(
			Number.isSafeInteger(requirement.min) && Number(requirement.min) >= 0,
			'Invalid tag minimum',
		);
		check(
			requirement.max === undefined ||
				(Number.isSafeInteger(requirement.max) &&
					Number(requirement.max) >= Number(requirement.min)),
			'Invalid tag maximum',
		);
		if (requirement.when !== undefined) {
			check(record(requirement.when), 'Invalid tag condition');
			text(requirement.when.tag, 'conditional tag');
			text(requirement.when.key, 'conditional field');
		}
	}
}
function validateStepDefinitions(value: unknown) {
	if (value === undefined) return;
	check(record(value), 'Invalid step definitions');
	for (const step of Object.values(value)) {
		check(record(step) && record(step.initial), 'Invalid step definition');
		if (step.fields === undefined) continue;
		check(Array.isArray(step.fields), 'Invalid step fields');
		for (const field of step.fields) {
			check(record(field), 'Invalid step field');
			text(field.key, 'step field key');
			check(
				field.valueType === undefined ||
					['string', 'array', 'object', 'number'].includes(
						String(field.valueType),
					),
				'Invalid step value type',
			);
			check(
				field.properties === undefined ||
					(record(field.properties) &&
						Object.values(field.properties).every((kind) =>
							['string', 'number'].includes(String(kind)),
						)),
				'Invalid step properties',
			);
			check(
				field.required === undefined || typeof field.required === 'boolean',
				'Invalid required step field',
			);

			check(
				field.prefix === undefined || typeof field.prefix === 'string',
				'Invalid step prefix',
			);
			check(
				field.quote === undefined || typeof field.quote === 'boolean',
				'Invalid step quoting',
			);
		}
	}
}
function validateSections(
	value: unknown,
): asserts value is ItemSection[] | undefined {
	if (value === undefined) return;
	list(value, 'sections');
	for (const section of value) {
		text(section.title, 'section title');
		check(
			['text', 'checkboxes', 'radio'].includes(String(section.type)),
			'Invalid section type',
		);
		if (section.type === 'text') {
			check(
				typeof section.text === 'string' && section.text.length <= limits.text,
				'Invalid section text',
			);
		} else {
			list(section.options, 'section options');
			for (const option of section.options) {
				text(option.label, 'option label');
				check(typeof option.selected === 'boolean', 'Invalid option selection');
			}
			check(
				section.type !== 'radio' ||
					section.options.filter((option) => option.selected).length <= 1,
				'Radio sections allow only one selected option',
			);
		}
	}
}
export function safeRelativePath(path: string): boolean {
	return (
		path.startsWith('.tale/') &&
		path.endsWith('.tale') &&
		!path.includes('\\') &&
		!path.includes(':') &&
		!path.includes('\0') &&
		path
			.split('/')
			.every((part) => part !== '..' && part !== '.' && part.length > 0)
	);
}
export function parseProject(source: string): Project {
	check(source.length <= MAX_PROJECT_BYTES, 'Project exceeds 8 MB');
	const value: unknown = JSON.parse(source);
	validateProject(value);
	for (const tag of value.itemTypes)
		tag.definition ??= structuredClone(definition(tag));
	return value;
}
export function serializeProject(project: Project): string {
	validateProject(project);
	return `${JSON.stringify(project, null, 2)}\n`;
}
export function id(): string {
	return crypto.randomUUID();
}

export function validateDirectory(value: unknown): asserts value is string {
	text(value, 'deployment directory');
	check(!value.includes('\0'), 'Invalid deployment directory');
}
