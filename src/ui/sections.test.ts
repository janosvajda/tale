// @browser-test
import { duplicateSection, newSection } from '../model/fields.js';
import type { ItemSection } from '../model/project.js';
import { customSection, sectionPicker } from './sections.js';

function check(condition: unknown, message: string) {
	if (!condition) throw new Error(message);
}
export function run() {
	const host = document.createElement('div');
	document.body.append(host);
	try {
		pickerChecks(host);
		choiceChecks(host, 'checkboxes');
		choiceChecks(host, 'radio');
		textChecks(host);
	} finally {
		host.remove();
	}
}
function pickerChecks(host: HTMLElement) {
	const created: ItemSection[] = [];
	const picker = sectionPicker((section) => created.push(section), []);
	host.append(picker);
	for (const type of [
		'Free text',
		'Checkboxes',
		'Radio buttons',
		'Free text',
	]) {
		picker
			.querySelector<HTMLButtonElement>('[aria-label="Add section"]')
			?.click();
		check(
			picker.querySelector('[popover]')?.matches(':popover-open'),
			'Picker must open',
		);
		picker
			.querySelector<HTMLButtonElement>(`[aria-label="Add ${type}"]`)
			?.click();
		check(
			!picker.querySelector('[popover]')?.matches(':popover-open'),
			'Choosing a type must dismiss picker',
		);
	}
	check(
		created.map((section) => section.type).join(',') ===
			'text,checkboxes,radio,text',
		'Every type must be addable repeatedly without predefined fields',
	);
	check(
		new Set(created.map((section) => section.id)).size === created.length,
		'New sections need independent IDs',
	);
	picker.remove();
}
function choiceChecks(host: HTMLElement, type: 'checkboxes' | 'radio') {
	let section = newSection(type);
	let view: HTMLElement;
	const render = () => {
		host.replaceChildren();
		view = customSection(
			section,
			(next) => {
				section = next;
				render();
			},
			() => {},
			() => {},
		);
		(view as HTMLDetailsElement).open = true;
		host.append(view);
	};
	render();
	view!
		.querySelector<HTMLInputElement>('[aria-label="Select Option 1"]')
		?.click();
	view!
		.querySelector<HTMLInputElement>('[aria-label="Select Option 2"]')
		?.click();
	check(
		section.type !== 'text' &&
			section.options.filter((option) => option.selected).length ===
				(type === 'radio' ? 1 : 2),
		'Choice controls must preserve their selection semantics',
	);
	view!.querySelector<HTMLButtonElement>('[aria-label="Add option"]')?.click();
	const label = view!
		.querySelectorAll<HTMLInputElement>('[aria-label="Option label"]')
		.item(2);
	label.value = 'A custom option';
	label.dispatchEvent(new Event('change'));
	check(
		section.type !== 'text' &&
			section.options.at(-1)?.label === 'A custom option',
		'Options must be editable',
	);
	view!
		.querySelector<HTMLButtonElement>(
			'[aria-label="Delete option A custom option"]',
		)
		?.click();
	check(
		section.type !== 'text' && section.options.length === 2,
		'Option deletion must remove only the named option',
	);
	const copy = duplicateSection(section);
	check(
		copy.id !== section.id &&
			copy.type !== 'text' &&
			section.type !== 'text' &&
			copy.options[0]?.id !== section.options[0]?.id,
		'Duplicates need independent section and option IDs',
	);
}
function textChecks(host: HTMLElement) {
	let section: ItemSection = newSection('text');
	const view = customSection(
		section,
		(next) => {
			section = next;
		},
		() => {},
		() => {},
	);
	host.replaceChildren(view);
	view.open = true;
	const text = view.querySelector('textarea');
	check(text, 'Free text needs a textarea');
	if (text) {
		text.value = 'Use plain language.\nKeep changes small.';
		text.dispatchEvent(new Event('change'));
	}
	check(
		section.type === 'text' && section.text.includes('\n'),
		'Text must preserve multiple lines',
	);
	const title = view.querySelector<HTMLInputElement>(
		'[aria-label="Section title"]',
	);
	if (title) {
		title.value = 'Communication';
		title.dispatchEvent(new Event('change'));
	}
	check(section.title === 'Communication', 'Section titles must be editable');
}
