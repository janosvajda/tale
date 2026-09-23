import { compile } from '../application/compiler.js';
import { Editor } from '../editor/editor.js';
import { navigationMode } from '../editor/navigation.js';
import { type MenuAction, type Reply, validateReply } from '../model/bridge.js';
import { catalogue } from '../model/catalogue.js';
import {
	check,
	type Definition,
	id,
	type Project,
	serializeProject,
} from '../model/project.js';
import { skillCatalogue } from '../model/skills.js';
import { generatedTag, nameAvailable, unusedColor } from '../model/tags.js';
import { applicationBridge } from '../platform/runtime.js';
import { openDeployment } from './deployment.js';
import { decorateIcon, icon, iconButton } from './icons.js';
import { openNewProject } from './new-project.js';

const ui = {
	errorMs: 10000,
	messageMs: 4000,
	textRows: 8,
	percent: 100,
	zoomStep: 1.2,
};
const api = applicationBridge();

function get<T extends HTMLElement = HTMLElement>(selector: string): T {
	const node = document.querySelector<T>(selector);
	if (!node) throw new Error(`Missing UI element: ${selector}`);
	return node;
}
function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
	className?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	if (className) node.className = className;
	return node;
}
function button(
	label: string,
	action: () => void,
	className?: string,
): HTMLButtonElement {
	const node = el('button', label, className);
	node.type = 'button';
	node.addEventListener('click', action);
	return node;
}
async function response(promise: Promise<Reply>) {
	const result: unknown = await promise;
	validateReply(result);
	if (!result.ok) throw new Error(result.error);
	return result;
}

let editor: Editor;
let saved = '';
let projectReady = false;
let busy = false;
let paletteKind: 'tag' | 'skill' = 'tag';
let managerKind: 'tag' | 'skill' = 'tag';
let managerQuery = '';
let selectedDefinition: string | null = null;
let projectSettingsOpen = false;
let manager: HTMLDialogElement | undefined;
let messageTimer: ReturnType<typeof setTimeout>;

function notify(message: string, error = false) {
	const status = get('#status');
	status.replaceChildren(
		icon(error ? 'warning' : 'info'),
		el('span', message, 'status-message'),
		iconButton('close', 'Dismiss message', () => {
			clearTimeout(messageTimer);
			status.className = '';
		}),
	);
	status.setAttribute('role', error ? 'alert' : 'status');
	status.className = error ? 'visible error' : 'visible';
	clearTimeout(messageTimer);
	messageTimer = setTimeout(
		() => {
			status.className = '';
		},
		error ? ui.errorMs : ui.messageMs,
	);
}
function safe(action: () => void) {
	try {
		action();
	} catch (error) {
		notify(error instanceof Error ? error.message : String(error), true);
	}
}
function mutate(action: (project: Project) => void) {
	safe(() => editor.mutate(action));
}
function updateActions() {
	for (const control of document.querySelectorAll<HTMLButtonElement>(
		'[data-action], #export-tales',
	))
		control.disabled =
			busy || (control.dataset.action === 'deploy' && !projectReady);
	get<HTMLButtonElement>('#library-settings').disabled = busy;
}
function setBusy(value: boolean) {
	busy = value;
	document.body.dataset.busy = String(value);
	updateActions();
}
function availableDefinitions(): Definition[] {
	const embedded = editor.project.definitions;
	const ids = new Set(embedded.map((entry) => entry.id));
	const names = new Set(embedded.map((entry) => entry.name.toLowerCase()));
	return [
		...embedded,
		...[...catalogue.tags, ...skillCatalogue].filter(
			(entry) => !ids.has(entry.id) && !names.has(entry.name.toLowerCase()),
		),
	];
}
function sortedDefinitions(kind: 'tag' | 'skill', query = ''): Definition[] {
	const needle = query.trim().toLowerCase();
	return availableDefinitions()
		.filter(
			(entry) =>
				entry.kind === kind && entry.name.toLowerCase().includes(needle),
		)
		.sort((left, right) => left.name.localeCompare(right.name));
}
function builtIn(id: string): Definition | undefined {
	return [...catalogue.tags, ...skillCatalogue].find(
		(entry) => entry.id === id,
	);
}
function editDefinition(
	id: string,
	action: (definition: Definition, project: Project) => void,
) {
	mutate((project) => {
		let definition = project.definitions.find((entry) => entry.id === id);
		if (!definition) {
			const preset = builtIn(id);
			check(preset, 'Missing definition');
			definition = structuredClone(preset);
			project.definitions.push(definition);
		}
		action(definition, project);
	});
}
function palette() {
	const list = get('#type-list');
	list.replaceChildren();
	const query = get<HTMLInputElement>('#type-search')
		.value.trim()
		.toLowerCase();
	get('#tag-tab').setAttribute('aria-selected', String(paletteKind === 'tag'));
	get('#skill-tab').setAttribute(
		'aria-selected',
		String(paletteKind === 'skill'),
	);
	get<HTMLInputElement>('#type-search').placeholder = `Find a ${paletteKind}…`;
	for (const definition of sortedDefinitions(paletteKind, query)) {
		const row = el('div', undefined, 'type-button');
		row.dataset.typeId = definition.id;
		row.draggable = true;
		row.title = `Drag ${definition.name} onto the diagram`;
		row.addEventListener('dragstart', (event) => {
			event.dataTransfer?.setData('application/x-tale-type', definition.id);
			if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
		});
		const dot = el('span', undefined, 'swatch');
		dot.style.backgroundColor = definition.color;
		const info = iconButton('info', `About ${definition.name}`, () => {
			get<HTMLDetailsElement>('#palette').open = false;
			openManager(definition);
		});
		info.classList.add('type-info');
		info.title = `${definition.name}\n\n${definition.defaultText || 'No default text yet.'}\n\nClick to edit this default.`;
		info.draggable = false;
		info.addEventListener('dragstart', (event) => event.preventDefault());
		row.append(
			dot,
			el('span', definition.name, 'type-name'),
			info,
			iconButton('plus', `Add ${definition.name} to diagram`, () => {
				get<HTMLDetailsElement>('#palette').open = false;
				projectSettingsOpen = false;
				editor.add(definition.id, definition);
			}),
		);
		list.append(row);
	}
}
function field(
	label: string,
	value: string,
	changed: (value: string) => void,
	multiline = false,
) {
	const wrapper = el('label', undefined, 'field');
	wrapper.append(el('span', label));
	const input = multiline ? el('textarea') : el('input');
	input.value = value;
	input.setAttribute('aria-label', label);
	if (input instanceof HTMLTextAreaElement) input.rows = ui.textRows;
	input.addEventListener('change', () => safe(() => changed(input.value)));
	wrapper.append(input);
	return wrapper;
}
function closeInspector() {
	projectSettingsOpen = false;
	editor.selected.clear();
	editor.render();
	inspector();
}
function inspector() {
	const pane = get('#inspector');
	pane.replaceChildren();
	const selected = [...editor.selected][0];
	const item = editor.project.diagram.items.find(
		(entry) => entry.id === selected,
	);
	const edge = editor.project.diagram.connections.find(
		(entry) => entry.id === selected,
	);
	pane.hidden = !projectSettingsOpen && !item && !edge;
	if (pane.hidden) return;
	const content = el('div', undefined, 'inspector-content');
	const header = el('div', undefined, 'inspector-header');
	header.append(
		el('h2', projectSettingsOpen ? 'Project' : (item?.title ?? 'Arrow')),
		iconButton('close', 'Close inspector', closeInspector),
	);
	pane.append(header, content);
	if (projectSettingsOpen) {
		content.append(
			field('Project name', editor.project.name, (name) =>
				mutate((project) => {
					project.name = name;
				}),
			),
		);
		content.append(
			field(
				'About this project',
				editor.project.description,
				(text) =>
					mutate((project) => {
						project.description = text;
					}),
				true,
			),
		);
		const environments = el('div', undefined, 'environments');
		environments.append(el('h3', 'Environments'));
		for (const environment of editor.project.environments) {
			const row = el('div', undefined, 'environment-row');
			row.append(
				field('Environment name', environment.name, (name) =>
					mutate((project) => {
						const target = project.environments.find(
							(entry) => entry.id === environment.id,
						);
						if (target) target.name = name;
					}),
				),
				iconButton('trash', `Remove ${environment.name}`, () =>
					mutate((project) => {
						project.environments = project.environments.filter(
							(entry) => entry.id !== environment.id,
						);
					}),
				),
			);
			environments.append(row);
		}
		environments.append(
			button(
				'Add environment',
				() =>
					mutate((project) => {
						project.environments.push({ id: id(), name: 'New environment' });
					}),
				'quiet',
			),
		);
		content.append(environments);
		return;
	}
	if (item) {
		const definition = editor.project.definitions.find(
			(entry) => entry.id === item.definitionId,
		);
		content.append(
			el(
				'p',
				`${definition?.kind === 'skill' ? 'Skill' : 'Tag'} in this diagram`,
				'inspector-context',
			),
		);
		content.append(
			field('Title', item.title, (title) =>
				mutate((project) => {
					const target = project.diagram.items.find(
						(entry) => entry.id === item.id,
					);
					if (target) target.title = title;
				}),
			),
		);
		content.append(
			field(
				'Text',
				item.text,
				(text) =>
					mutate((project) => {
						const target = project.diagram.items.find(
							(entry) => entry.id === item.id,
						);
						if (target) target.text = text;
					}),
				true,
			),
		);
		content.append(
			el(
				'p',
				'This text appears in the generated Tale. Editing it does not change the reusable default.',
				'small-note',
			),
		);
		const actions = el('div', undefined, 'inspector-item-actions');
		actions.append(
			iconButton('duplicate', 'Duplicate this item', () => {
				editor.selected = new Set([item.id]);
				editor.duplicate();
			}),
			iconButton('trash', 'Delete this item', () => {
				editor.selected = new Set([item.id]);
				editor.remove();
			}),
		);
		content.append(actions);
		return;
	}
	if (edge) {
		content.append(el('p', 'Arrow between diagram items', 'small-note'));
		const endpoints = el(
			'p',
			`${editor.project.diagram.items.find((entry) => entry.id === edge.from)?.title ?? 'Unknown'} → ${editor.project.diagram.items.find((entry) => entry.id === edge.to)?.title ?? 'Unknown'}`,
		);
		content.append(
			endpoints,
			field('Relationship (for example, guides)', edge.label ?? '', (label) =>
				mutate((project) => {
					const target = project.diagram.connections.find(
						(entry) => entry.id === edge.id,
					);
					if (target) target.label = label;
				}),
			),
			iconButton('trash', 'Delete arrow', () => editor.remove()),
		);
	}
}

function selectDefinition(definition: Definition) {
	selectedDefinition = definition.id;
	for (const row of manager?.querySelectorAll<HTMLButtonElement>(
		'.definition-row',
	) ?? [])
		row.setAttribute(
			'aria-current',
			String(row.dataset.definitionId === definition.id),
		);
	const detail = manager?.querySelector<HTMLElement>('.definitions-detail');
	if (!detail) return;
	detail.replaceChildren();
	renderDefinition(detail, definition);
	detail.scrollTop = 0;
}
function renderDefinitionList(list: HTMLElement, detail: HTMLElement) {
	const definitions = sortedDefinitions(managerKind, managerQuery);
	if (!definitions.some((entry) => entry.id === selectedDefinition))
		selectedDefinition = definitions[0]?.id ?? null;
	list.replaceChildren();
	for (const definition of definitions) {
		const row = button(
			definition.name,
			() => selectDefinition(definition),
			'definition-row',
		);
		row.dataset.definitionId = definition.id;
		row.setAttribute(
			'aria-current',
			String(selectedDefinition === definition.id),
		);
		const dot = el('span', undefined, 'tag-card-colour');
		dot.style.backgroundColor = definition.color;
		row.prepend(dot);
		list.append(row);
	}
	detail.replaceChildren();
	const selected = definitions.find((entry) => entry.id === selectedDefinition);
	if (selected) renderDefinition(detail, selected);
	else
		detail.append(
			el(
				'p',
				managerQuery
					? `No matching ${managerKind}s.`
					: `No ${managerKind}s yet.`,
				'definitions-empty',
			),
		);
}
function renderManager(resetListScroll = false) {
	if (!manager) return;
	const scrollTop = resetListScroll
		? 0
		: (manager.querySelector<HTMLElement>('.definitions-list')?.scrollTop ?? 0);
	manager.replaceChildren();
	const header = el('div', undefined, 'dialog-header');
	header.append(
		el('h2', 'Tags & skills'),
		iconButton('close', 'Close Tags and skills', () => manager?.close()),
	);
	const body = el('div', undefined, 'definitions-layout');
	const sidebar = el('div', undefined, 'definitions-sidebar');
	const tabs = el('div', undefined, 'manager-tabs');
	for (const kind of ['tag', 'skill'] as const) {
		const tab = button(kind === 'tag' ? 'Tags' : 'Skills', () => {
			managerKind = kind;
			managerQuery = '';
			selectedDefinition = null;
			renderManager(true);
			manager?.querySelector<HTMLInputElement>('.definitions-search')?.focus();
		});
		tab.setAttribute('aria-selected', String(managerKind === kind));
		tabs.append(tab);
	}
	const search = el('input');
	search.type = 'search';
	search.className = 'definitions-search';
	search.placeholder = `Find a ${managerKind}…`;
	search.setAttribute('aria-label', `Find a ${managerKind}`);
	search.value = managerQuery;
	sidebar.append(tabs, search);
	const list = el('div', undefined, 'definitions-list');
	const detail = el('div', undefined, 'definitions-detail');
	search.addEventListener('input', () => {
		managerQuery = search.value;
		renderDefinitionList(list, detail);
		list.scrollTop = 0;
	});
	renderDefinitionList(list, detail);
	list.scrollTop = scrollTop;
	sidebar.append(
		list,
		button(
			`New ${managerKind}`,
			() => {
				const name = managerKind === 'skill' ? 'New skill' : 'New tag';
				const definition: Definition = {
					id: id(),
					kind: managerKind,
					name,
					tag:
						managerKind === 'skill'
							? 'SKILL'
							: generatedTag(name, editor.project.definitions),
					color:
						managerKind === 'skill'
							? '#6D28D9'
							: unusedColor(editor.project.definitions),
					defaultText: '',
				};
				mutate((project) => {
					definition.name = uniqueName(name, project.definitions);
					project.definitions.push(definition);
				});
				selectedDefinition = definition.id;
				managerQuery = '';
				renderManager();
			},
			'quiet wide',
		),
	);
	body.append(sidebar, detail);
	manager.append(header, body);
}
function uniqueName(base: string, definitions: Definition[]): string {
	let name = base;
	let index = 2;
	while (!nameAvailable(name, definitions)) {
		name = `${base} ${index}`;
		index++;
	}
	return name;
}
function renderDefinition(detail: HTMLElement, definition: Definition) {
	detail.append(
		el('h3', definition.name),
		el('p', 'Default text for new diagram items', 'small-note'),
	);
	detail.append(
		field('Name', definition.name, (name) => {
			editDefinition(definition.id, (target, project) => {
				check(
					nameAvailable(name, project.definitions, target.id),
					'A Tag or Skill with this name already exists',
				);
				target.name = name.trim();
				if (target.kind === 'tag')
					target.tag = generatedTag(
						target.name,
						project.definitions.filter((entry) => entry.id !== target.id),
					);
			});
			renderManager();
		}),
	);
	const colour = el('label', undefined, 'definition-colour');
	colour.append(el('span', 'Colour'));
	const swatch = el('input');
	swatch.type = 'color';
	swatch.value = definition.color;
	swatch.setAttribute('aria-label', 'Colour');
	swatch.addEventListener('change', () => {
		editDefinition(definition.id, (target) => {
			target.color = swatch.value;
		});
	});
	colour.append(swatch);
	detail.append(colour);
	detail.append(
		field(
			'Default text',
			definition.defaultText,
			(text) =>
				editDefinition(definition.id, (target) => {
					target.defaultText = text;
				}),
			true,
		),
	);
	detail.append(
		el(
			'p',
			'New diagram items start with this text. Existing items keep their own text.',
			'small-note',
		),
	);
	const actions = el('div', undefined, 'definition-actions');
	const original = builtIn(definition.id);
	if (original)
		actions.append(
			button(
				'Restore original',
				() => {
					if (!window.confirm(`Restore the original ${definition.name}?`))
						return;
					mutate((project) => {
						const index = project.definitions.findIndex(
							(entry) => entry.id === definition.id,
						);
						if (index >= 0)
							project.definitions[index] = structuredClone(original);
					});
					renderManager();
				},
				'quiet',
			),
		);
	else
		actions.append(
			iconButton('trash', `Delete ${definition.name}`, () => {
				if (!window.confirm(`Delete ${definition.name}?`)) return;
				mutate((project) => {
					check(
						!project.diagram.items.some(
							(item) => item.definitionId === definition.id,
						),
						'Remove its diagram items first',
					);
					project.definitions = project.definitions.filter(
						(entry) => entry.id !== definition.id,
					);
				});
				selectedDefinition = null;
				renderManager();
			}),
		);
	detail.append(actions);
}
function openManager(selected?: Definition) {
	if (!manager) {
		manager = el('dialog');
		manager.id = 'definitions-dialog';
		manager.setAttribute('aria-label', 'Tags and skills');
		manager.addEventListener('keydown', (event) => {
			if (
				event.key.length !== 1 ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey
			)
				return;
			const target = event.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			)
				return;
			const search = manager?.querySelector<HTMLInputElement>(
				'.definitions-search',
			);
			if (!search) return;
			search.focus();
			search.value += event.key;
			search.dispatchEvent(new Event('input', { bubbles: true }));
			event.preventDefault();
		});
		document.body.append(manager);
	}
	managerKind = selected?.kind ?? managerKind;
	managerQuery = '';
	selectedDefinition = selected?.id ?? null;
	renderManager(true);
	manager.showModal();
	manager.querySelector<HTMLInputElement>('.definitions-search')?.focus();
}

function refresh(edited: boolean) {
	get('#project-name').textContent = editor.project.name;
	const dirty = serializeProject(editor.project) !== saved;
	get('#dirty').classList.toggle('visible', dirty);
	document.title = `${dirty ? '• ' : ''}${editor.project.name} — Tale`;
	if (edited)
		void response(api.setDirty(dirty)).catch((error) =>
			notify(String(error), true),
		);
	get('#zoom').textContent =
		`${Math.round(editor.project.diagram.viewport.zoom * ui.percent)}%`;
	get('#board-count').textContent =
		`${editor.project.diagram.items.length} notes · ${editor.project.diagram.connections.length} arrows`;
	for (const tool of ['select', 'hand', 'arrow'])
		get(`#${tool}-tool`).classList.toggle('active', editor.tool === tool);
	palette();
	inspector();
}
function previewTales() {
	const artifact = compile(editor.project)[0];
	check(artifact, 'Nothing to preview');
	const select = get<HTMLSelectElement>('#artifact-select');
	select.replaceChildren(el('option', artifact.path));
	select.value = artifact.path;
	get<HTMLTextAreaElement>('#compiled-output').value = artifact.content;
	get<HTMLDialogElement>('#preview').showModal();
}
async function createDocument() {
	const result = await openNewProject(api);
	if (!result) return;
	editor.setProject(result.project);
	saved = '';
	projectReady = true;
	projectSettingsOpen = false;
	if (editor.project.diagram.items.length) editor.fit();
	refresh(false);
}
async function openOrSave(
	command: 'open' | 'save' | 'saveAs',
	recentPath?: string,
) {
	const result = await response(
		command === 'open'
			? api.open(recentPath)
			: api.save(editor.project, command === 'saveAs'),
	);
	if (result.cancelled) return;
	if (result.document) {
		if (command === 'open') editor.setProject(result.document.project);
		saved = serializeProject(result.document.project);
		projectReady = true;
		projectSettingsOpen = false;
		await response(api.setDirty(serializeProject(editor.project) !== saved));
		refresh(false);
	}
	if (result.message) notify(result.message);
}
async function showRecentProjects() {
	const result = await response(api.recentProjects());
	const list = get('#recent-project-list');
	list.replaceChildren();
	for (const path of result.recentProjects ?? []) {
		const name = path.replaceAll('\\', '/').split('/').at(-1) ?? path;
		const entry = button('', () => void action('open', path), 'recent-project');
		entry.title = path;
		entry.setAttribute('aria-label', `Open recent project ${name}`);
		entry.append(el('span', name), el('small', path));
		list.append(entry);
	}
	get('#recent-projects').hidden = !list.childElementCount;
}
async function action(command: MenuAction, recentPath?: string) {
	if (busy) return;
	get<HTMLDetailsElement>('#file-menu').open = false;
	if (command === 'compile') {
		safe(previewTales);
		return;
	}
	if (command === 'deploy') {
		if (!projectReady) {
			notify('Create or open a project first.', true);
			return;
		}
		openDeployment(structuredClone(editor.project), notify, api);
		return;
	}
	setBusy(true);
	try {
		if (command === 'exit') {
			await response(api.exit());
			return;
		}
		if (command === 'new') await createDocument();
		else await openOrSave(command, recentPath);
	} catch (error) {
		notify(error instanceof Error ? error.message : String(error), true);
	} finally {
		setBusy(false);
	}
}
function icons() {
	for (const [selector, name, label] of [
		['#undo', 'undo', 'Undo'],
		['#redo', 'redo', 'Redo'],
		['#zoom-in', 'plus', 'Zoom in'],
		['#zoom-out', 'minus', 'Zoom out'],
		['#fit', 'fit', 'Fit diagram'],
		['#select-tool', 'select', 'Select and move'],
		['#hand-tool', 'hand', 'Pan'],
		['#arrow-tool', 'arrow', 'Draw arrow'],
		['#palette > summary', 'plus', 'Add a note'],
		['#close-preview', 'close', 'Close preview'],
		['.appbar > [data-action="save"]', 'save', 'Save'],
		['.appbar > [data-action="exit"]', 'exit', 'Exit Tale'],
		['.appbar > [data-action="compile"]', 'eye', 'Preview Tale'],
	] as const)
		decorateIcon(get(selector), name, label);
	get('#library-settings').replaceChildren(
		icon('edit'),
		el('span', 'Tags & skills'),
	);
	get('.appbar > [data-action="deploy"]').replaceChildren(
		icon('deploy'),
		el('span', 'Deploy Tale'),
	);
}
function dismissMenus() {
	const menus = [
		...document.querySelectorAll<HTMLDetailsElement>('details.dropdown'),
	];
	document.addEventListener(
		'pointerdown',
		(event) => {
			for (const menu of menus)
				if (!menu.contains(event.target as Node)) menu.open = false;
		},
		true,
	);
	document.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Escape') return;
			const open = menus.find((menu) => menu.open);
			if (!open) return;
			for (const menu of menus) menu.open = false;
			open.querySelector('summary')?.focus();
			event.preventDefault();
			event.stopPropagation();
		},
		true,
	);
}
function navigationControls() {
	const control = get<HTMLSelectElement>('#navigation-mode');
	function apply(value: string | null) {
		const mode = navigationMode(value);
		editor.navigation.mode = mode;
		control.value = mode;
		get('#navigation-hint').textContent =
			mode === 'mouse'
				? 'Right / Space + drag to pan · Wheel or pinch to zoom'
				: 'Two fingers to pan · Pinch or Ctrl / ⌘ + wheel to zoom';
		localStorage.setItem('tale.navigation', mode);
	}
	apply(localStorage.getItem('tale.navigation'));
	control.addEventListener('change', () => apply(control.value));
}
async function start() {
	icons();
	const result = await response(api.load());
	check(result.document, 'No project received');
	editor = new Editor(get('#canvas'), result.document.project);
	saved = serializeProject(result.document.project);
	projectReady = Boolean(result.document.path);
	dismissMenus();
	navigationControls();
	editor.onChange = (edited) => {
		if (!edited && editor.selected.size) projectSettingsOpen = false;
		refresh(edited);
	};
	editor.onEdit = () => {
		projectSettingsOpen = false;
		inspector();
		get<HTMLInputElement>('#inspector input[aria-label="Title"]').focus();
	};
	for (const control of document.querySelectorAll<HTMLButtonElement>(
		'[data-action]',
	))
		control.addEventListener('click', () => {
			void action(control.dataset.action as MenuAction);
		});
	api.onMenu((command) => {
		void action(command);
	});
	get<HTMLDetailsElement>('#file-menu').addEventListener('toggle', (event) => {
		if ((event.currentTarget as HTMLDetailsElement).open)
			void showRecentProjects().catch((error) =>
				notify(error instanceof Error ? error.message : String(error), true),
			);
	});
	for (const tool of ['select', 'hand', 'arrow'] as const)
		get(`#${tool}-tool`).addEventListener('click', () => {
			editor.tool = tool;
			editor.render();
			refresh(false);
		});
	get('#type-search').addEventListener('input', palette);
	get<HTMLDetailsElement>('#palette').addEventListener('toggle', (event) => {
		if ((event.currentTarget as HTMLDetailsElement).open)
			get<HTMLInputElement>('#type-search').focus();
	});
	for (const kind of ['tag', 'skill'] as const)
		get(`#${kind}-tab`).addEventListener('click', () => {
			paletteKind = kind;
			get<HTMLInputElement>('#type-search').value = '';
			palette();
		});
	get('#project-settings').addEventListener('click', () => {
		projectSettingsOpen = true;
		get<HTMLDetailsElement>('#palette').open = false;
		inspector();
	});
	get('#library-settings').addEventListener('click', () => openManager());
	const canvas = get('#canvas');
	canvas.addEventListener('dragover', (event) => {
		if (!event.dataTransfer?.types.includes('application/x-tale-type')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	});
	canvas.addEventListener('drop', (event) => {
		const typeId = event.dataTransfer?.getData('application/x-tale-type');
		if (!typeId) return;
		event.preventDefault();
		const definition = availableDefinitions().find(
			(entry) => entry.id === typeId,
		);
		if (!definition) return;
		get<HTMLDetailsElement>('#palette').open = false;
		projectSettingsOpen = false;
		editor.addAt(typeId, { x: event.clientX, y: event.clientY }, definition);
	});
	get('#undo').addEventListener('click', () => editor.undo());
	get('#redo').addEventListener('click', () => editor.redo());
	get('#zoom-in').addEventListener('click', () => editor.zoom(ui.zoomStep));
	get('#zoom-out').addEventListener('click', () =>
		editor.zoom(1 / ui.zoomStep),
	);
	get('#fit').addEventListener('click', () => editor.fit());
	get('#close-preview').addEventListener('click', () =>
		get<HTMLDialogElement>('#preview').close(),
	);
	get('#export-tales').addEventListener('click', () => {
		if (busy) return;
		setBusy(true);
		void response(api.exportTales(editor.project))
			.then((result) => {
				if (result.message) notify(result.message);
			})
			.catch((error) => notify(String(error), true))
			.finally(() => setBusy(false));
	});
	refresh(false);
	updateActions();
	document.body.dataset.ready = 'true';
}
void start().catch((error) =>
	notify(error instanceof Error ? error.message : 'Could not start Tale', true),
);
