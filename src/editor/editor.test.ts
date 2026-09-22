// @browser-test
import type { DiagramItem, Project } from '../model/project.js';
import { Editor } from './editor.js';

function verifyClipboard(editor: Editor, item: DiagramItem, before: number) {
	editor.selected = new Set([item.id]);
	const clipboard = new DataTransfer();
	for (const type of ['copy', 'paste'])
		editor.scene.element.dispatchEvent(
			new ClipboardEvent(type, {
				bubbles: true,
				cancelable: true,
				clipboardData: clipboard,
			}),
		);
	if (!clipboard.getData('application/x-tale-diagram'))
		throw new Error('Copy did not put the selected box on the clipboard');
	const pasted = editor.project.diagram.items.at(-1);
	if (
		editor.project.diagram.items.length !== before + 2 ||
		pasted?.id === item.id ||
		pasted?.title !== item.title ||
		pasted.position.x <= item.position.x
	)
		throw new Error('Paste must create an offset copy of the selected box');
	editor.undo();
	if (editor.project.diagram.items.length !== before + 1)
		throw new Error('Paste was not undoable');
}
function verifyDeleteKeys(editor: Editor, item: DiagramItem, before: number) {
	for (const key of ['Backspace', 'Delete']) {
		editor.selected = new Set([item.id]);
		editor.scene.element.dispatchEvent(
			new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
		);
		if (editor.project.diagram.items.length !== before)
			throw new Error(`${key} did not delete the selected box`);
		editor.undo();
	}
}
function verifyConnectedPaste(editor: Editor) {
	const edge = editor.project.diagram.connections[0];
	if (!edge) throw new Error('Missing connected fixture items');
	const originalItems = editor.project.diagram.items.length;
	const originalEdges = editor.project.diagram.connections.length;
	editor.selected = new Set([edge.from, edge.to]);
	const clipboard = new DataTransfer();
	for (const type of ['copy', 'paste'])
		editor.scene.element.dispatchEvent(
			new ClipboardEvent(type, { bubbles: true, clipboardData: clipboard }),
		);
	const pasted = editor.project.diagram.connections.at(-1);
	if (
		editor.project.diagram.items.length !== originalItems + 2 ||
		editor.project.diagram.connections.length !== originalEdges + 1 ||
		!pasted ||
		!editor.selected.has(pasted.from) ||
		!editor.selected.has(pasted.to)
	)
		throw new Error('Pasted boxes must keep their connecting arrow');
	editor.undo();
}
export function run(project: Project) {
	const host = document.createElement('div');
	document.body.append(host);
	try {
		const editor = new Editor(host, project);
		const before = editor.project.diagram.items.length;
		const definition = project.definitions[0];
		if (!definition) throw new Error('Missing fixture definition');
		editor.add(definition.id);
		const item = editor.project.diagram.items.at(-1);
		if (
			editor.project.diagram.items.length !== before + 1 ||
			item?.text !== definition.defaultText
		)
			throw new Error('Adding a note must copy its human-language default');
		editor.selected.add(item.id);
		editor.duplicate();
		if (editor.project.diagram.items.length !== before + 2)
			throw new Error('Duplicate failed');
		editor.undo();
		if (editor.project.diagram.items.length !== before + 1)
			throw new Error('Undo failed');
		const remove = editor.scene.element.querySelector(
			`[data-delete="${item.id}"]`,
		);
		if (!remove) throw new Error('Diagram box has no delete control');
		remove.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				pointerId: 1,
			}),
		);
		if (editor.project.diagram.items.length !== before)
			throw new Error('Box delete did not remove its item');
		editor.undo();
		if (editor.project.diagram.items.length !== before + 1)
			throw new Error('Box delete was not undoable');
		verifyClipboard(editor, item, before);
		verifyConnectedPaste(editor);
		verifyDeleteKeys(editor, item, before);
		editor.remove();
		if (editor.project.diagram.items.length !== before + 1)
			throw new Error('Removing an empty selection changed the diagram');
	} finally {
		host.remove();
	}
}
