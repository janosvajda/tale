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
	list(value.itemTypes, 'item types');
	list(value.environments, 'environments');
	list(value.exports, 'exports');
	const types = new Set(value.itemTypes.map((t) => t.id));
	const tagByColor = new Map<string, string>();
	const colorByTag = new Map<string, string>();
	for (const t of value.itemTypes) {
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
	return value;
}
export function serializeProject(project: Project): string {
	validateProject(project);
	return `${JSON.stringify(project, null, 2)}\n`;
}
export function id(): string {
	return crypto.randomUUID();
}
