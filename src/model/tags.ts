import type { Definition } from './project.js';

export function generatedTag(name: string, existing: Definition[]): string {
	const base = name
		.normalize('NFKD')
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/^[^A-Z]+/, '');
	const stem = base || 'TAG';
	let candidate = stem;
	let index = 2;
	while (
		existing.some(
			(definition) => definition.kind === 'tag' && definition.tag === candidate,
		)
	) {
		candidate = `${stem}_${index}`;
		index++;
	}
	return candidate;
}

export function nameAvailable(
	name: string,
	definitions: Definition[],
	exceptId?: string,
): boolean {
	const normalized = name.trim().toLowerCase();
	return (
		normalized.length > 0 &&
		!definitions.some(
			(definition) =>
				definition.id !== exceptId &&
				definition.name.trim().toLowerCase() === normalized,
		)
	);
}

export function unusedColor(definitions: Definition[]): string {
	const colors = [
		'#2563EB',
		'#7C3AED',
		'#15803D',
		'#C2410C',
		'#0E7490',
		'#BE185D',
	];
	return (
		colors.find(
			(color) =>
				!definitions.some(
					(definition) => definition.color.toUpperCase() === color,
				),
		) ?? '#475569'
	);
}
