import type { Definition } from './project.js';
import data from './skills.json';

export const skillCatalogue = (
	data as { version: number; skills: Definition[] }
).skills;

export function createSkill(name: string, color = '#6D28D9'): Definition {
	return {
		id: crypto.randomUUID(),
		kind: 'skill',
		name,
		tag: 'SKILL',
		color,
		defaultText: '',
	};
}
