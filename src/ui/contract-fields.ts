import { conditions, itemTag } from '../model/contract.js';
import { fieldLabel, readable } from '../model/fields.js';
import {
	type DiagramItem,
	id,
	type Json,
	type Project,
} from '../model/project.js';
import { ruleSection } from './fields.js';

export function contractFields(
	project: Project,
	item: DiagramItem,
	mutate: (edit: (project: Project) => void) => void,
): HTMLElement {
	const tag = itemTag(project, item);
	const host = document.createElement('div');
	host.className = 'contract-fields';
	const fields =
		tag === 'REQUIREMENT'
			? ['action', 'condition', 'subject', 'expected', 'mandatory']
			: ['action', 'executable', 'timeout_ms'];
	for (const key of fields) {
		if (hiddenField(key, item)) continue;
		host.append(
			control(key, item.properties[key] ?? '', (value) =>
				mutate((p) => {
					const target = p.diagram.items.find((entry) => entry.id === item.id);
					if (target) target.properties[key] = value;
				}),
			),
		);
	}
	if (tag === 'CHECK') {
		for (const key of ['arguments', 'protected_files'])
			host.append(
				ruleSection(
					tag,
					key,
					item.properties[key] ?? [],
					(value) =>
						mutate((p) => {
							const target = p.diagram.items.find(
								(entry) => entry.id === item.id,
							);
							if (target) target.properties[key] = value;
						}),
					() =>
						mutate((p) => {
							const target = p.diagram.items.find(
								(entry) => entry.id === item.id,
							);
							if (target) target.properties[key] = [];
						}),
				),
			);
	} else {
		const label = document.createElement('strong');
		label.textContent = 'Verified by';
		host.append(label);
		for (const candidate of project.diagram.items.filter(
			(entry) => itemTag(project, entry) === 'CHECK',
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
function hiddenField(key: string, item: DiagramItem) {
	return (
		(key === 'subject' && item.properties.condition === 'command_succeeds') ||
		(key === 'expected' && item.properties.condition !== 'equals_file')
	);
}
function control(
	key: string,
	value: Json,
	update: (value: Json) => void,
): HTMLElement {
	const label = document.createElement('label');
	label.className = 'field';
	const title = document.createElement('span');
	title.textContent = fieldLabel(key);
	const input =
		key === 'condition'
			? document.createElement('select')
			: document.createElement('input');
	input.setAttribute('aria-label', fieldLabel(key));
	if (input instanceof HTMLSelectElement)
		for (const condition of conditions) {
			const option = document.createElement('option');
			option.value = condition;
			option.textContent = readable(condition);
			input.append(option);
		}
	if (input instanceof HTMLInputElement) {
		input.type =
			typeof value === 'boolean'
				? 'checkbox'
				: typeof value === 'number'
					? 'number'
					: 'text';
		if (typeof value === 'boolean') input.checked = value;
	}
	input.value = String(value);
	input.addEventListener('change', () =>
		update(
			input instanceof HTMLInputElement && input.type === 'checkbox'
				? input.checked
				: typeof value === 'number'
					? Number(input.value)
					: input.value,
		),
	);
	label.append(title, input);
	return label;
}
