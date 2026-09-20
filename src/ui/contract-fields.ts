import {
	definition,
	type FieldDefinition,
	itemRole,
} from '../model/catalogue.js';
import { fieldLabel } from '../model/fields.js';
import { type DiagramItem, id, type Project } from '../model/project.js';
import { control, ruleSection } from './fields.js';

export function contractFields(
	project: Project,
	item: DiagramItem,
	mutate: (edit: (project: Project) => void) => void,
): HTMLElement {
	const tag = project.itemTypes.find((tag) => tag.id === item.typeId)!;
	const spec = definition(tag);
	const host = document.createElement('div');
	host.className = 'contract-fields';
	for (const field of spec.fields ?? []) {
		if (field.source || hiddenField(field, item)) continue;
		const key = field.key;
		const value = item.properties[key] ?? field.initial ?? '';
		const update = (value: import('../model/project.js').Json) =>
			mutate((p) => {
				const target = p.diagram.items.find((entry) => entry.id === item.id);
				if (target) target.properties[key] = value;
			});
		host.append(
			Array.isArray(value)
				? ruleSection(tag, key, value, update, () => update([]))
				: control(tag, key, value, update, fieldLabel(key, tag)),
		);
	}
	if (spec.role === 'requirement') {
		const label = document.createElement('strong');
		label.textContent = 'Verified by';
		host.append(label);
		for (const candidate of project.diagram.items.filter(
			(entry) => itemRole(project, entry) === 'check',
		)) {
			const row = document.createElement('label');
			row.className = 'contract-link';
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.setAttribute('aria-label', `Verified by ${candidate.title}`);
			input.checked = project.diagram.connections.some(
				(edge) =>
					edge.from === item.id &&
					edge.to === candidate.id &&
					edge.kind === 'verified_by',
			);
			input.addEventListener('change', () =>
				mutate((p) => {
					p.diagram.connections = p.diagram.connections.filter(
						(edge) =>
							!(
								edge.from === item.id &&
								edge.to === candidate.id &&
								edge.kind === 'verified_by'
							),
					);
					if (input.checked)
						p.diagram.connections.push({
							id: id(),
							from: item.id,
							to: candidate.id,
							kind: 'verified_by',
							order: 0,
						});
				}),
			);
			row.append(input, document.createTextNode(candidate.title));
			host.append(row);
		}
		const hint = document.createElement('p');
		hint.className = 'small-note';
		hint.textContent =
			'Connect this requirement to a check for the same action. You can also draw a Verified by arrow.';
		host.append(hint);
	}
	return host;
}
function hiddenField(field: FieldDefinition, item: DiagramItem) {
	const condition = field.visibleWhen;
	if (!condition) return false;
	const value = item.properties[condition.key];
	return condition.equals !== undefined
		? value !== condition.equals
		: value === condition.notEquals;
}
