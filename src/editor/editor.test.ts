// @browser-test
import type { Project } from '../model/project.js';
import { Editor } from './editor.js';

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
		editor.remove();
		if (editor.project.diagram.items.length !== before + 1)
			throw new Error('Removing an empty selection changed the diagram');
	} finally {
		host.remove();
	}
}
