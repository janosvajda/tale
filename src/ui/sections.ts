import {
	newSection,
	sectionSummary,
	sectionTypeLabel,
} from '../model/fields.js';
import { type ItemSection, id, type SectionOption } from '../model/project.js';
import { type IconName, icon, iconButton } from './icons.js';

function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	return node;
}
const typeIcons: Record<ItemSection['type'], IconName> = {
	text: 'text',
	checkboxes: 'checkboxes',
	radio: 'radio',
};
export function sectionPicker(
	add: (section: ItemSection) => void,
	presets: { label: string; add: () => void }[],
): HTMLElement {
	const picker = element('div');
	picker.className = 'section-picker';
	const panel = element('div');
	panel.className = 'section-picker-panel';
	panel.id = `picker-${id()}`;
	panel.setAttribute('popover', 'auto');
	const trigger = iconButton('plus', 'Add section', () => {
		const rect = trigger.getBoundingClientRect();
		panel.style.top = `${rect.bottom}px`;
		panel.style.right = `${innerWidth - rect.right}px`;
		panel.togglePopover();
	});
	trigger.classList.add('primary');
	trigger.setAttribute('aria-controls', panel.id);
	trigger.setAttribute('aria-expanded', 'false');
	panel.addEventListener('toggle', () =>
		trigger.setAttribute(
			'aria-expanded',
			String(panel.matches(':popover-open')),
		),
	);
	for (const type of ['text', 'checkboxes', 'radio'] as const) {
		const choice = element('button');
		choice.type = 'button';
		choice.className = 'section-type-choice';
		choice.setAttribute('aria-label', `Add ${sectionTypeLabel(type)}`);
		const label = element('span', sectionTypeLabel(type));
		const hint = element(
			'small',
			{
				text: 'Write freely',
				checkboxes: 'Select multiple options',
				radio: 'Select one option',
			}[type],
		);
		label.append(hint);
		choice.append(icon(typeIcons[type]), label);
		choice.addEventListener('click', () => {
			if (panel.matches(':popover-open')) panel.hidePopover();
			add(newSection(type));
		});
		panel.append(choice);
	}
	if (presets.length) {
		const details = element('details');
		details.className = 'restore-fields';
		details.append(element('summary', 'Restore project field'));
		for (const preset of presets) {
			const choice = element('button', preset.label);
			choice.type = 'button';
			choice.addEventListener('click', () => {
				if (panel.matches(':popover-open')) panel.hidePopover();
				preset.add();
			});
			details.append(choice);
		}
		panel.append(details);
	}
	picker.append(trigger, panel);
	return picker;
}
function namedInput(
	label: string,
	value: string,
	update: (value: string) => void,
): HTMLInputElement {
	const input = element('input');
	input.value = value;
	input.setAttribute('aria-label', label);
	input.addEventListener('change', () => {
		const next = input.value.trim();
		if (next) update(next);
		else input.value = value;
	});
	return input;
}
function optionRow(
	section: Extract<ItemSection, { options: SectionOption[] }>,
	option: SectionOption,
	update: (section: ItemSection) => void,
): HTMLElement {
	const row = element('div');
	row.className = 'section-option';
	row.dataset.option = option.id;
	const selected = element('input');
	selected.type = section.type === 'radio' ? 'radio' : 'checkbox';
	selected.name = `section-${section.id}`;
	selected.checked = option.selected;
	selected.setAttribute('aria-label', `Select ${option.label}`);
	selected.addEventListener('change', () =>
		update({
			...section,
			options: section.options.map((candidate) => ({
				...candidate,
				selected:
					candidate.id === option.id
						? selected.checked
						: section.type === 'radio'
							? false
							: candidate.selected,
			})),
		}),
	);
	const label = namedInput('Option label', option.label, (value) =>
		update({
			...section,
			options: section.options.map((candidate) =>
				candidate.id === option.id ? { ...candidate, label: value } : candidate,
			),
		}),
	);
	const remove = iconButton('trash', `Delete option ${option.label}`, () =>
		update({
			...section,
			options: section.options.filter(
				(candidate) => candidate.id !== option.id,
			),
		}),
	);
	remove.classList.add('danger');
	row.append(selected, label, remove);
	return row;
}
export function customSection(
	section: ItemSection,
	update: (section: ItemSection) => void,
	duplicate: () => void,
	remove: () => void,
): HTMLDetailsElement {
	const node = element('details');
	node.className = 'rule-section custom-section';
	node.dataset.section = section.id;
	node.dataset.sectionType = section.type;
	const header = element('summary');
	const title = element('span');
	title.className = 'rule-section-title';
	title.append(
		element('strong', section.title),
		element('small', sectionSummary(section) || sectionTypeLabel(section.type)),
	);
	const copy = iconButton('copy', `Duplicate ${section.title}`, duplicate);
	const trash = iconButton('trash', `Delete ${section.title}`, remove);
	trash.classList.add('danger');
	for (const button of [copy, trash])
		button.addEventListener('click', (event) => event.preventDefault());
	header.append(icon(typeIcons[section.type]), title, copy, trash);
	const body = element('div');
	body.className = 'rule-section-content';
	body.append(
		namedInput('Section title', section.title, (title) =>
			update({ ...section, title }),
		),
	);
	if (section.type === 'text') {
		const text = element('textarea');
		text.value = section.text;
		text.placeholder = 'Write your instructions…';
		text.setAttribute('aria-label', 'Section text');
		text.addEventListener('change', () =>
			update({ ...section, text: text.value }),
		);
		body.append(text);
	} else {
		const options = element('div');
		options.className = 'section-options';
		for (const option of section.options)
			options.append(optionRow(section, option, update));
		body.append(
			options,
			iconButton('plus', 'Add option', () =>
				update({
					...section,
					options: [
						...section.options,
						{
							id: id(),
							label: `Option ${section.options.length + 1}`,
							selected: false,
						},
					],
				}),
			),
		);
	}
	node.append(header, body);
	return node;
}
