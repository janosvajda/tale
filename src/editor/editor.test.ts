// @browser-test

import type { Project } from '../model/project.js';
import { Editor } from './editor.js';

function predefinedContent(editor: Editor) {
	editor.mutate((project) =>
		project.itemTypes.push({
			id: 'prefilled-note',
			tag: 'TEAM_NOTE',
			label: 'Team note',
			color: '#123456',
			definition: {
				initial: {
					properties: { tone: 'concise' },
					sections: [
						{
							id: 'choices',
							title: 'Checks',
							type: 'checkboxes',
							options: [{ id: 'test', label: 'Run tests', selected: true }],
						},
					],
				},
			},
		}),
	);
	editor.add('prefilled-note');
	const first = editor.project.diagram.items.at(-1)!;
	editor.add('prefilled-note');
	const second = editor.project.diagram.items.at(-1)!;
	const section = first.sections?.[0];
	const other = second.sections?.[0];
	if (!section || !other || section.type === 'text' || other.type === 'text')
		throw new Error('Predefined content was not instantiated');
	if (
		section.id === other.id ||
		section.options[0]?.id === other.options[0]?.id
	)
		throw new Error('Copies need independent section and option IDs');
	section.options[0]!.selected = false;
	first.properties.tone = 'detailed';
	if (!other.options[0]?.selected || second.properties.tone !== 'concise')
		throw new Error('Editing one predefined tag changed another');
	editor.add('prefilled-note');
	if (editor.project.diagram.items.at(-1)?.properties.tone !== 'concise')
		throw new Error('Editing changed the catalogue default');
}

function scrollSelection(editor: Editor) {
	const items = JSON.stringify(editor.project.diagram.items);
	const initial = structuredClone(editor.project);
	const svg = editor.scene.element;
	const wheel = () =>
		svg.dispatchEvent(
			new WheelEvent('wheel', {
				deltaX: 12,
				deltaY: 24,
				bubbles: true,
				cancelable: true,
			}),
		);
	editor.navigation.mode = 'trackpad';
	editor.selected.clear();
	wheel();
	const emptySelection = { ...editor.project.diagram.viewport };
	if (
		emptySelection.zoom !== initial.diagram.viewport.zoom ||
		emptySelection.y !== initial.diagram.viewport.y - 24
	)
		throw new Error('An unselected board must pan with trackpad scrolling');
	editor.setProject(initial);
	editor.selected.add(initial.diagram.items[0]!.id);
	wheel();
	if (
		JSON.stringify(editor.project.diagram.viewport) !==
		JSON.stringify(emptySelection)
	)
		throw new Error('Selection must not change navigation behavior');
	if (JSON.stringify(editor.project.diagram.items) !== items)
		throw new Error('Scrolling must never move board objects');
	editor.setProject(initial);
}
export function run(project: Project) {
	const host = document.createElement('div');
	document.body.append(host);
	try {
		const editor = new Editor(host, project);
		scrollSelection(editor);
		const before = JSON.stringify(editor.project);
		try {
			editor.mutate((p) => {
				p.diagram.viewport.zoom = 0;
			});
			throw new Error('Invalid mutation was accepted');
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === 'Invalid mutation was accepted'
			)
				throw error;
		}
		if (JSON.stringify(editor.project) !== before)
			throw new Error('Failed edits must roll back');
		const item = editor.project.diagram.items[0];
		if (!item) throw new Error('Missing fixture');
		editor.selected.add(item.id);
		editor.duplicate();
		if (
			editor.project.diagram.items.length !==
			project.diagram.items.length + 1
		)
			throw new Error('Duplicate failed');
		editor.undo();
		if (JSON.stringify(editor.project) !== before)
			throw new Error('Undo must restore exact project');
		editor.redo();
		if (
			editor.project.diagram.items.length !==
			project.diagram.items.length + 1
		)
			throw new Error('Redo failed');
		predefinedContent(editor);
	} finally {
		host.remove();
	}
}
