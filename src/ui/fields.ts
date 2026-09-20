import {
	catalogue,
	definition,
	type TagReference,
} from '../model/catalogue.js';
import {
	availableFields,
	duplicateSection,
	fieldChoices,
	fieldLabel,
	initialValue,
	readable,
	stepTemplate,
	summary,
} from '../model/fields.js';
import type { ItemSection, Json } from '../model/project.js';
import { iconButton } from './icons.js';
import { customSection, sectionPicker } from './sections.js';

type Update = (value: Json) => void;
function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	return node;
}
function select(
	values: string[],
	value: string,
	label: string,
): HTMLSelectElement {
	const node = el('select');
	node.setAttribute('aria-label', label);
	for (const choice of new Set([...values, value])) {
		const option = el('option', readable(choice));
		option.value = choice;
		node.append(option);
	}
	node.value = value;
	return node;
}
function choiceControl(
	options: string[],
	value: string,
	update: Update,
	label: string,
): HTMLElement {
	const group = el('div');
	const node = select(options, value, label);
	const custom = el('option', 'Another option…');
	custom.value = '__custom_choice__';
	node.append(custom);
	node.addEventListener('change', () => {
		if (node.value !== custom.value) {
			update(node.value);
			return;
		}
		const input = el('input');
		input.setAttribute('aria-label', `Custom ${label}`);
		input.placeholder = 'Describe your choice';
		input.addEventListener('change', () => {
			if (input.value.trim()) update(input.value.trim());
		});
		group.replaceChildren(node, input);
		input.focus();
	});
	group.append(node);
	return group;
}
function scalar(
	tag: TagReference,
	key: string,
	value: Json,
	update: Update,
	label: string,
): HTMLElement {
	const options = fieldChoices(tag, key, value);
	if (options.length && typeof value === 'string') {
		return choiceControl(options, value, update, label);
	}
	const node =
		definition(tag).fields?.find((field) => field.key === key)?.format ===
		'lines'
			? el('textarea')
			: el('input');
	node.setAttribute('aria-label', label);
	if (node instanceof HTMLInputElement) {
		node.type =
			typeof value === 'boolean'
				? 'checkbox'
				: typeof value === 'number'
					? 'number'
					: 'text';
		if (typeof value === 'boolean') {
			node.checked = value;
			node.setAttribute('role', 'switch');
		}
		if (typeof value === 'number') node.step = 'any';
	}
	node.value = value === null ? '' : String(value);
	node.addEventListener('change', () => {
		if (node instanceof HTMLInputElement && node.type === 'checkbox')
			update(node.checked);
		else if (typeof value === 'number') {
			if (node.value.trim() && node.checkValidity()) update(Number(node.value));
			else {
				node.value = String(value);
				node.reportValidity();
			}
		} else update(node.value);
	});
	return node;
}
function checklist(
	options: string[],
	values: Json[],
	update: Update,
	label: string,
): HTMLElement {
	const group = el('div');
	group.className = 'rule-options';
	for (const option of new Set([...options, ...values.map(String)])) {
		const row = el('label');
		const input = el('input');
		input.type = 'checkbox';
		input.checked = values.includes(option);
		input.setAttribute('aria-label', `${label}: ${readable(option)}`);
		input.addEventListener('change', () => {
			const selected = new Set(values);
			if (input.checked) selected.add(option);
			else selected.delete(option);
			update(
				[...new Set([...options, ...values.map(String)])].filter((value) =>
					selected.has(value),
				),
			);
		});
		row.append(input, el('span', readable(option)));
		group.append(row);
	}
	const extra = el('input');
	extra.setAttribute('aria-label', `New ${label} option`);
	extra.placeholder = 'Another option';
	group.append(
		extra,
		iconButton('plus', 'Add option', () => {
			const value = extra.value.trim();
			if (value && !values.includes(value)) update([...values, value]);
		}),
	);
	return group;
}
function list(
	tag: TagReference,
	key: string,
	values: Json[],
	update: Update,
	label: string,
): HTMLElement {
	const options = fieldChoices(tag, key, values);
	if (options.length) return checklist(options, values, update, label);
	const group = el('div');
	group.className = 'rule-list';
	group.append(listAdder(key, values, update));
	values.forEach((value, index) => {
		const row = el('div');
		row.className = 'rule-entry';
		const title = `${key === 'steps' || key === 'children' ? 'Step' : 'Entry'} ${index + 1}`;
		row.append(entryActions(values, index, update, title));
		row.append(
			control(
				key === 'steps' || key === 'children' ? 'step' : tag,
				key === 'steps' || key === 'children' ? 'step' : 'entry',
				value,
				(next) => update(values.map((v, i) => (i === index ? next : v))),
				title,
			),
		);
		group.append(row);
	});
	return group;
}
function entryActions(
	values: Json[],
	index: number,
	update: Update,
	title: string,
): HTMLElement {
	const actions = el('div');
	actions.className = 'rule-entry-actions';
	const move = iconButton('up', `Move ${title} up`, () => {
		const next = [...values];
		const previous = next[index - 1];
		const value = next[index];
		if (previous === undefined || value === undefined) return;
		next[index - 1] = value;
		next[index] = previous;
		update(next);
	});
	move.disabled = index === 0;
	move.setAttribute('aria-label', `Move ${title} up`);
	const duplicate = iconButton('copy', `Duplicate ${title}`, () => {
		const value = values[index];
		if (value === undefined) return;
		const next = [...values];
		next.splice(index + 1, 0, structuredClone(value));
		update(next);
	});
	duplicate.setAttribute('aria-label', `Duplicate ${title}`);
	const remove = iconButton('trash', `Delete ${title}`, () =>
		update(values.filter((_, i) => i !== index)),
	);
	remove.setAttribute('aria-label', `Delete ${title}`);
	remove.classList.add('danger');
	actions.append(el('strong', title), move, duplicate, remove);
	return actions;
}
function listAdder(key: string, values: Json[], update: Update): HTMLElement {
	const row = el('div');
	row.className = 'list-add';
	if (key === 'steps' || key === 'children') {
		const operation = select(
			Object.keys(catalogue.steps),
			Object.keys(catalogue.steps)[0] ?? '',
			'New step action',
		);
		row.append(
			operation,
			iconButton('plus', 'Add step', () =>
				update([...values, stepTemplate(operation.value)]),
			),
		);
	} else
		row.append(
			iconButton('plus', key === 'paths' ? 'Add path' : 'Add entry', () =>
				update([...values, '']),
			),
		);
	return row;
}
function object(
	tag: TagReference,
	value: Record<string, Json>,
	update: Update,
	label: string,
): HTMLElement {
	const group = el('fieldset');
	group.className = 'rule-object';
	group.append(el('legend', label));
	for (const [key, child] of Object.entries(value)) {
		const updateChild = (next: Json) => {
			if (tag === 'step' && key === 'operation' && typeof next === 'string') {
				if (next === value.operation) return;
				if (
					!window.confirm(
						'Change this action? Its current fields will be replaced.',
					)
				)
					return;
				update(stepTemplate(next));
			} else update({ ...value, [key]: next });
		};
		group.append(control(tag, key, child, updateChild, fieldLabel(key, tag)));
	}
	return group;
}
export function control(
	tag: TagReference,
	key: string,
	value: Json,
	update: Update,
	label = fieldLabel(key, tag),
): HTMLElement {
	if (Array.isArray(value)) {
		const group = el('fieldset');
		group.className = 'rule-group';
		group.append(el('legend', label), list(tag, key, value, update, label));
		return group;
	}
	if (value !== null && typeof value === 'object')
		return object(tag, value, update, label);
	const wrapper = el('label');
	wrapper.className = typeof value === 'boolean' ? 'rule-switch' : 'field';
	wrapper.append(el('span', label), scalar(tag, key, value, update, label));
	return wrapper;
}
export function ruleSection(
	tag: TagReference,
	key: string,
	value: Json,
	update: Update,
	remove: () => void,
): HTMLDetailsElement {
	const section = el('details');
	section.className = 'rule-section';
	section.dataset.section = key;
	const header = el('summary');
	const title = el('span');
	title.className = 'rule-section-title';
	title.append(
		el('strong', fieldLabel(key, tag)),
		el('small', summary(value, key)),
	);
	const removeButton = iconButton(
		'trash',
		`Delete ${fieldLabel(key, tag)}`,
		remove,
	);
	removeButton.classList.add('danger');
	removeButton.setAttribute('aria-label', `Delete ${fieldLabel(key, tag)}`);
	removeButton.addEventListener('click', (event) => event.preventDefault());
	header.append(title, removeButton);
	const body = el('div');
	body.className = 'rule-section-content';
	body.append(control(tag, key, value, update));
	section.append(header, body);
	return section;
}
export function ruleFields(
	tag: TagReference,
	properties: Record<string, Json>,
	update: (key: string, value: Json) => void,
	remove: (key: string) => void,
	sections: ItemSection[],
	updateSections: (sections: ItemSection[]) => void,
): HTMLElement {
	const group = el('div');
	group.className = 'rule-sections';
	const toolbar = el('div');
	toolbar.className = 'section-toolbar';
	toolbar.append(
		el('strong', 'Sections'),
		sectionPicker(
			(section) => updateSections([...sections, section]),
			availableFields(tag)
				.filter((key) => !(key in properties))
				.map((key) => ({
					label: fieldLabel(key, tag),
					add: () => update(key, initialValue(tag, key)),
				})),
		),
	);
	group.append(toolbar);
	for (const section of sections)
		group.append(
			customSection(
				section,
				(next) =>
					updateSections(
						sections.map((value) => (value.id === section.id ? next : value)),
					),
				() => {
					const next = [...sections];
					next.splice(
						sections.indexOf(section) + 1,
						0,
						duplicateSection(section),
					);
					updateSections(next);
				},
				() =>
					updateSections(sections.filter((value) => value.id !== section.id)),
			),
		);
	for (const [key, value] of Object.entries(properties)) {
		const section = ruleSection(
			tag,
			key,
			value,
			(next) => update(key, next),
			() => remove(key),
		);
		section.open = key === Object.keys(properties)[0];
		group.append(section);
	}
	if (!Object.keys(properties).length && !sections.length)
		group.append(el('p', 'Add a section to start defining this item.'));
	return group;
}
