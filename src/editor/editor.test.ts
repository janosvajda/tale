// @browser-test

import type { Project } from '../model/project.js';
import { Editor } from './editor.js';

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
	} finally {
		host.remove();
	}
}
