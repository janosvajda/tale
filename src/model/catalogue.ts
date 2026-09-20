import data from './catalogue.json';
import type {
	DiagramItem,
	ItemSection,
	ItemType,
	Json,
	Project,
} from './project.js';

export interface FieldDefinition {
	key: string;
	label?: string;
	initial?: Json;
	choices?: string[];
	format?: 'directive' | 'header' | 'lines' | 'values' | 'bullets' | 'steps';
	required?: boolean;
	allowSections?: boolean;
	equals?: Json;
	enum?: Json[];
	valueType?: 'string' | 'array';
	source?: 'id' | 'links';
	visibleWhen?: { key: string; equals?: Json; notEquals?: Json };
}
export interface TagDefinition {
	steps?: Record<string, StepDefinition>;
	role?: 'document' | 'requirement' | 'check' | 'proof' | 'override';
	fields?: FieldDefinition[];
	additionalProperties?: boolean;
	initial?: { properties: Record<string, Json>; sections: ItemSection[] };
	bindings?: Record<string, string>;
	requiredTags?: {
		tag: string;
		min: number;
		max?: number;
		when?: { tag: string; key: string; notEquals: Json };
	}[];
}
export interface StepField {
	key: string;
	quote?: boolean;
	prefix?: string;
	required?: boolean;
	valueType?: 'string' | 'array' | 'object' | 'number';
	properties?: Record<string, 'string' | 'number'>;
}
export interface StepDefinition {
	initial: Record<string, Json>;
	fields?: StepField[];
}
interface Catalogue {
	version: number;
	tags: ItemType[];
	labels: Record<string, string>;
	policies: string[];
	literalFields: string[];
	stepChoices: Record<string, string[]>;
	steps: Record<string, StepDefinition>;
}
export const catalogue = data as unknown as Catalogue;
export type TagReference = string | ItemType;
export function definition(tag: TagReference): TagDefinition {
	if (typeof tag !== 'string' && tag.definition !== undefined)
		return tag.definition;
	const name = typeof tag === 'string' ? tag : tag.tag;
	return catalogue.tags.find((entry) => entry.tag === name)?.definition ?? {};
}
export function itemDefinition(
	project: Project,
	item: DiagramItem,
): TagDefinition {
	const type = project.itemTypes.find((entry) => entry.id === item.typeId);
	return type ? definition(type) : {};
}
export function itemRole(
	project: Project,
	item: DiagramItem,
): TagDefinition['role'] {
	return itemDefinition(project, item).role;
}
export function boundProperties(
	project: Project,
	item: DiagramItem,
): Record<string, Json> {
	const bindings = itemDefinition(project, item).bindings ?? {};
	return Object.fromEntries(
		Object.entries(bindings).map(([key, field]) => [
			key,
			item.properties[field] ?? null,
		]),
	);
}
