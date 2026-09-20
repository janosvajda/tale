import { catalogue, definition, type TagReference } from './catalogue.js';
import type { Json } from './project.js';

export function validTag(tag: string): boolean {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	return (
		letters.includes(tag[0] ?? '') &&
		tag.length > 0 &&
		[...tag].every((c) => `${letters}0123456789_`.includes(c))
	);
}

export function unusedTagColor(used: string[]): string {
	const rgb = {
		start: 0x475569,
		step: 0x112233,
		max: 0x1000000,
		hex: 16,
		width: 6,
	};
	const occupied = new Set(used.map((color) => color.toUpperCase()));
	let value = rgb.start;
	let color: string;
	do {
		color = `#${value.toString(rgb.hex).padStart(rgb.width, '0').toUpperCase()}`;
		value = (value + rgb.step) % rgb.max;
	} while (occupied.has(color));
	return color;
}

export const directives: Record<string, string[]> = Object.fromEntries(
	catalogue.tags.map((tag) => [
		tag.tag,
		(tag.definition?.fields ?? []).map((field) => field.key),
	]),
);
export const tags = catalogue.tags.map((tag) => tag.tag);
export function defaults(tag: TagReference): Record<string, Json> {
	return structuredClone(definition(tag).initial?.properties ?? {});
}
