import { catalogue, definition, type TagReference } from './catalogue.js';
import { type ItemSection, id, type Json } from './project.js';

export function readable(value: string): string {
	const label = catalogue.labels[value];
	if (label) return label;
	if (!value.includes('_')) return value;
	const words = value.toLowerCase().split('_').join(' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}
export function fieldLabel(key: string, tag?: TagReference): string {
	const configured = tag
		? definition(tag).fields?.find((field) => field.key === key)?.label
		: undefined;
	const label = configured ?? readable(key);
	return label.charAt(0).toUpperCase() + label.slice(1);
}
export function fieldChoices(
	tag: TagReference,
	key: string,
	value: Json,
): string[] {
	const field = definition(tag).fields?.find((field) => field.key === key);
	const configured =
		tag === 'step' ? catalogue.stepChoices[key] : field?.choices;
	if (configured) return configured;
	if (typeof value === 'string' && catalogue.policies.includes(value))
		return catalogue.policies;
	const initial = field?.initial;
	return typeof initial === 'string' && initial ? [initial] : [];
}
export function stepTemplate(operation: string): Record<string, Json> {
	return structuredClone(
		catalogue.steps[operation]?.initial ?? {
			operation,
			args: [],
			attributes: {},
			children: [],
		},
	);
}
const literalFields = new Set(catalogue.literalFields);
export function summary(value: Json, key = ''): string {
	if (value === null) return 'Not set';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (Array.isArray(value))
		return value.map((child) => summary(child, key)).join(', ') || 'None';
	if (typeof value === 'object')
		return Object.entries(value)
			.map(([key, child]) => `${fieldLabel(key)}: ${summary(child, key)}`)
			.join(' · ');
	return typeof value === 'string' && !literalFields.has(key)
		? readable(value)
		: String(value);
}
export function itemSummary(properties: Record<string, Json>): string[] {
	return Object.entries(properties).flatMap(([key, value]) => {
		if (key === 'text' && typeof value === 'string') return value.split('\n');
		if (key === 'steps' && Array.isArray(value))
			return value.map((child) => summary(child));
		return [`${fieldLabel(key)}: ${summary(value, key)}`];
	});
}

export function availableFields(tag: TagReference): string[] {
	return (definition(tag).fields ?? [])
		.filter((field) => !field.source)
		.map((field) => field.key);
}
export function initialValue(tag: TagReference, key: string): Json {
	return structuredClone(
		definition(tag).fields?.find((field) => field.key === key)?.initial ?? '',
	);
}

export function newSection(type: ItemSection['type']): ItemSection {
	const base = { id: id(), title: sectionTypeLabel(type) };
	return type === 'text'
		? { ...base, type, text: '' }
		: {
				...base,
				type,
				options: [
					{ id: id(), label: 'Option 1', selected: false },
					{ id: id(), label: 'Option 2', selected: false },
				],
			};
}
export function sectionTypeLabel(type: ItemSection['type']): string {
	return {
		text: 'Free text',
		checkboxes: 'Checkboxes',
		radio: 'Radio buttons',
	}[type];
}
export function duplicateSection(section: ItemSection): ItemSection {
	const copy = structuredClone(section);
	copy.id = id();
	if (copy.type !== 'text')
		copy.options = copy.options.map((option) => ({ ...option, id: id() }));
	return copy;
}
export function sectionSummary(section: ItemSection): string {
	return section.type === 'text'
		? section.text
		: section.options
				.filter((option) => option.selected)
				.map((option) => option.label)
				.join(', ');
}
