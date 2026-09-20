import { type Artifact, compile } from '../application/compiler.js';
import { Editor } from '../editor/editor.js';
import { navigationMode } from '../editor/navigation.js';
import { type MenuAction, type Reply, validateReply } from '../model/bridge.js';
import { definition, itemRole } from '../model/catalogue.js';
import { inspectContract } from '../model/contract.js';
import {
	check,
	type DiagramItem,
	id,
	isColor,
	type Project,
	serializeProject,
} from '../model/project.js';
import { tags, unusedTagColor, validTag } from '../model/tags.js';
import { contractFields } from './contract-fields.js';
import { openDeployment } from './deployment.js';
import { ruleFields } from './fields.js';
import { decorateIcon, type IconName, icon, iconButton } from './icons.js';
import { openNewProject } from './new-project.js';
import { openVerification } from './verification.js';

function get<T extends HTMLElement = HTMLElement>(selector: string): T {
	const value = document.querySelector<T>(selector);
	if (!value) throw new Error(`Missing UI element: ${selector}`);
	return value;
}
function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
	className?: string,
): HTMLElementTagNameMap[K] {
	const value = document.createElement(tag);
	if (text !== undefined) value.textContent = text;
	if (className) value.className = className;
	return value;
}
const ui = {
	errorMs: 10000,
	messageMs: 4000,
	maxTextRows: 8,
	percent: 100,
	zoomStep: 1.2,
};

let editor: Editor;
let saved = '';
let workingPath: string | null = null;
let busy = false;
function setBusy(value: boolean) {
	busy = value;
	document.body.dataset.busy = String(value);
	for (const button of document.querySelectorAll<HTMLButtonElement>(
		'[data-action], #export-tales',
	))
		button.disabled = value;
}
let settings = false;
let artifacts: Artifact[] = [];
let statusTimer: ReturnType<typeof setTimeout>;
function notify(message: string, error = false) {
	const status = get('#status');
	status.textContent = message;
	status.className = error ? 'visible error' : 'visible';
	clearTimeout(statusTimer);
	statusTimer = setTimeout(
		() => {
			status.className = '';
		},
		error ? ui.errorMs : ui.messageMs,
	);
}
async function reply(
	promise: Promise<Reply>,
): Promise<Extract<Reply, { ok: true }>> {
	const result: unknown = await promise;
	validateReply(result);
	if (!result.ok) throw new Error(result.error);
	return result;
}
function guarded(action: () => void) {
	try {
		action();
	} catch (error) {
		notify(
			error instanceof Error ? error.message : 'Unable to update project',
			true,
		);
	}
}
function change(action: (project: Project) => void) {
	guarded(() => editor.mutate(action));
}
function button(
	label: string,
	action: () => void,
	className?: string,
): HTMLButtonElement {
	const value = element('button', label, className);
	value.type = 'button';
	value.addEventListener('click', () => guarded(action));
	return value;
}
function field(
	label: string,
	value: string,
	action: (value: string) => void,
	multiline = false,
): HTMLInputElement | HTMLTextAreaElement {
	const wrapper = element('label', undefined, 'field');
	wrapper.append(element('span', label));
	const input = multiline ? element('textarea') : element('input');
	input.value = value;
	input.setAttribute('aria-label', label);
	if (input instanceof HTMLTextAreaElement)
		input.rows = Math.min(
			ui.maxTextRows,
			Math.max(2, value.split('\n').length),
		);
	input.addEventListener('change', () => guarded(() => action(input.value)));
	wrapper.append(input);
	get('#inspector').append(wrapper);
	return input;
}
function heading(label: string) {
	get('#inspector').append(element('div', label, 'section-label'));
}
function selection(
	label: string,
	value: string,
	options: { value: string; label: string }[],
	action: (value: string) => void,
) {
	const wrapper = element('label', undefined, 'field');
	wrapper.append(element('span', label));
	const select = element('select');
	select.setAttribute('aria-label', label);
	for (const option of options) {
		const el = element('option', option.label);
		el.value = option.value;
		select.append(el);
	}
	select.value = value;
	select.addEventListener('change', () => guarded(() => action(select.value)));
	wrapper.append(select);
	get('#inspector').append(wrapper);
}
function refresh(edited: boolean) {
	get('#project-name').textContent = editor.project.name;
	const dirty = serializeProject(editor.project) !== saved;
	get('#dirty').classList.toggle('visible', dirty);
	document.title = `${dirty ? '• ' : ''}${editor.project.name} — Tale`;
	if (edited)
		void reply(window.tale.setDirty(dirty)).catch((error) =>
			notify(String(error), true),
		);
	get('#zoom').textContent =
		`${Math.round(editor.project.diagram.viewport.zoom * ui.percent)}%`;
	get('#board-count').textContent =
		`${editor.project.diagram.items.length} tags · ${editor.project.diagram.connections.length} connections`;
	for (const tool of ['select', 'hand', 'arrow'])
		get(`#${tool}-tool`).classList.toggle('active', editor.tool === tool);
	palette();
	const issues = inspectContract(editor.project).issues;
	const affected = new Set(issues.flatMap((issue) => issue.items));
	for (const node of document.querySelectorAll<SVGGElement>('[data-node]'))
		node.classList.toggle(
			'contract-invalid',
			affected.has(node.dataset.node ?? ''),
		);
	get('#contract-status').textContent = issues.length
		? `Check agreement · ${issues.length}`
		: 'Check agreement';
	inspector();
}
function palette() {
	const list = get('#type-list');
	const search = get<HTMLInputElement>('#type-search').value.toLowerCase();
	list.replaceChildren();
	for (const type of editor.project.itemTypes) {
		if (!`${type.label} ${type.tag}`.toLowerCase().includes(search)) continue;
		const add = button(
			type.label,
			() => {
				editor.add(type.id);
				settings = false;
				get<HTMLDetailsElement>('#palette').open = false;
				inspector();
			},
			'type-button',
		);
		add.dataset.typeId = type.id;
		add.title = `${type.tag} rectangle`;
		const swatch = element('span', undefined, 'swatch');
		swatch.style.backgroundColor = type.color;
		add.prepend(swatch);
		list.append(add);
	}
}
function itemActions(item: DiagramItem): HTMLElement {
	const row = element('div', undefined, 'inspector-item-actions');
	row.append(
		iconButton('save', 'Save as predefined tag', () =>
			change((project) => {
				const type = project.itemTypes.find((type) => type.id === item.typeId);
				check(type, 'Missing tag definition');
				project.itemTypes.push({
					...structuredClone(type),
					id: id(),
					label: item.title,
					definition: {
						...structuredClone(definition(type)),
						initial: {
							properties: structuredClone(item.properties),
							sections: structuredClone(item.sections ?? []),
						},
					},
				});
				notify('Predefined tag added to the palette');
			}),
		),
		iconButton('copy', 'Duplicate tag', () =>
			guarded(() => {
				editor.selected = new Set([item.id]);
				editor.duplicate();
			}),
		),
		iconButton('trash', 'Delete tag', () =>
			guarded(() => {
				editor.selected = new Set([item.id]);
				editor.remove();
			}),
		),
	);
	row.lastElementChild?.classList.add('danger');
	return row;
}
function inspector() {
	const pane = get('#inspector');
	const context = `${editor.project.id}:${settings ? 'settings' : [...editor.selected].join(',')}`;
	const same = pane.dataset.context === context;
	const scroll = same
		? (pane.querySelector('.inspector-content')?.scrollTop ?? 0)
		: 0;
	const sections = new Map(
		[...pane.querySelectorAll<HTMLDetailsElement>('[data-section]')].map(
			(section) => [section.dataset.section, section.open],
		),
	);
	const active = document.activeElement;
	const focused =
		same && pane.contains(active) && active instanceof HTMLElement
			? {
					label: active.getAttribute('aria-label'),
					section:
						active.closest<HTMLElement>('[data-section]')?.dataset.section,
					option: active.closest<HTMLElement>('[data-option]')?.dataset.option,
				}
			: undefined;
	renderInspector();
	pane.dataset.context = context;
	const header = pane.querySelector('.inspector-header');
	const toolbar = pane.querySelector('.section-toolbar');
	const content = element('div', undefined, 'inspector-content');
	if (toolbar) pane.append(toolbar);
	for (const child of [...pane.children])
		if (child !== header && child !== toolbar) content.append(child);
	pane.append(content);
	restoreInspector(content, same, sections, focused, scroll);
}
function restoreInspector(
	content: HTMLElement,
	same: boolean,
	sections: Map<string | undefined, boolean>,
	focused:
		| { label: string | null; section?: string; option?: string }
		| undefined,
	scroll: number,
) {
	let added: HTMLDetailsElement | undefined;
	if (same)
		for (const section of content.querySelectorAll<HTMLDetailsElement>(
			'[data-section]',
		)) {
			section.open = sections.get(section.dataset.section) ?? true;
			if (!sections.has(section.dataset.section)) added = section;
		}
	content.scrollTop = scroll;
	if (added) {
		added.open = true;
		added.scrollIntoView({ block: 'nearest' });
		added
			.querySelector<HTMLElement>('input, select, textarea')
			?.focus({ preventScroll: true });
	} else if (focused?.label) {
		const scope =
			[
				...content.querySelectorAll<HTMLElement>(
					'[data-option], [data-section]',
				),
			].find((node) =>
				focused.option
					? node.dataset.option === focused.option
					: node.dataset.section === focused.section,
			) ?? content;
		[...scope.querySelectorAll<HTMLElement>('[aria-label]')]
			.find((node) => node.getAttribute('aria-label') === focused.label)
			?.focus({ preventScroll: true });
	}
}
function knownRelationship(kind: string) {
	return ['contains', 'verified_by'].includes(kind);
}
function isContractType(
	type: import('../model/project.js').ItemType | undefined,
) {
	return (
		type !== undefined &&
		['requirement', 'check'].includes(definition(type).role ?? '')
	);
}
function relationshipOptions(kind: string) {
	return [
		{ value: 'contains', label: 'Contains' },
		{ value: 'verified_by', label: 'Verified by' },
		...(!knownRelationship(kind) ? [{ value: kind, label: kind }] : []),
	];
}
function renderInspector() {
	const pane = get('#inspector');
	pane.replaceChildren();
	const selected = [...editor.selected][0];
	const item = editor.project.diagram.items.find((i) => i.id === selected);
	const edge = editor.project.diagram.connections.find(
		(e) => e.id === selected,
	);
	pane.hidden = !settings && !item && !edge;
	if (pane.hidden) return;
	const header = element('div', undefined, 'inspector-header');
	header.append(
		element('h2', settings ? 'Project' : item ? item.title : 'Connection'),
		iconButton('close', 'Close inspector', () => {
			settings = false;
			editor.selected.clear();
			editor.render();
			inspector();
		}),
	);
	pane.append(header);
	if (settings) {
		projectSettings();
		return;
	}
	if (item) {
		field('Title', item.title, (title) =>
			change((p) => {
				const target = p.diagram.items.find((i) => i.id === item.id);
				if (target) target.title = title;
			}),
		);
		const type = editor.project.itemTypes.find((t) => t.id === item.typeId);
		pane.append(
			element(
				'p',
				`${type?.tag} · ${editor.selected.size > 1 ? `${editor.selected.size} selected` : 'Rectangle'}`,
				'small-note',
			),
		);
		header.append(itemActions(item));
		if (isContractType(type)) {
			pane.append(contractFields(editor.project, item, change));
			return;
		}
		pane.append(
			ruleFields(
				type ?? '',
				item.properties,
				(key, value) =>
					change((p) => {
						const target = p.diagram.items.find((i) => i.id === item.id);
						if (target) target.properties[key] = value;
					}),
				(key) =>
					change((p) => {
						const target = p.diagram.items.find((i) => i.id === item.id);
						if (target)
							target.properties = Object.fromEntries(
								Object.entries(target.properties).filter(
									([name]) => name !== key,
								),
							);
					}),
				item.sections ?? [],
				(sections) =>
					change((p) => {
						const target = p.diagram.items.find((i) => i.id === item.id);
						if (target) target.sections = sections;
					}),
			),
		);
	} else if (edge) {
		selection(
			'From',
			edge.from,
			editor.project.diagram.items.map((i) => ({
				value: i.id,
				label: i.title,
			})),
			(value) =>
				change((p) => {
					const e = p.diagram.connections.find((e) => e.id === edge.id);
					if (e) e.from = value;
				}),
		);
		selection(
			'To',
			edge.to,
			editor.project.diagram.items.map((i) => ({
				value: i.id,
				label: i.title,
			})),
			(value) =>
				change((p) => {
					const e = p.diagram.connections.find((e) => e.id === edge.id);
					if (e) e.to = value;
				}),
		);
		selection(
			'Relationship',
			edge.kind,
			relationshipOptions(edge.kind),
			(value) =>
				change((p) => {
					const e = p.diagram.connections.find((e) => e.id === edge.id);
					if (e) e.kind = value;
				}),
		);
		pane.append(
			element(
				'p',
				'Drag the line to shape it. Drag an endpoint to reconnect.',
				'small-note',
			),
		);
		pane.append(
			button(
				'Reset curve',
				() =>
					change((p) => {
						const e = p.diagram.connections.find((e) => e.id === edge.id);
						if (e)
							p.diagram.connections = p.diagram.connections.map((connection) =>
								connection === e
									? (Object.fromEntries(
											Object.entries(connection).filter(
												([key]) => key !== 'bend',
											),
										) as typeof e)
									: connection,
							);
					}),
				'wide quiet',
			),
			button('Delete connection', () => editor.remove(), 'wide danger'),
		);
	}
}
function projectSettings() {
	const pane = get('#inspector');
	field('Project name', editor.project.name, (name) =>
		change((p) => {
			p.name = name;
		}),
	);
	pane.append(element('p', workingPath ?? 'Unsaved project', 'small-note'));
	heading('Environments');
	for (const env of editor.project.environments) {
		field('Environment name', env.name, (name) =>
			change((p) => {
				const e = p.environments.find((e) => e.id === env.id);
				if (e) e.name = name;
			}),
		);
		pane.append(
			button(
				`Remove ${env.name}`,
				() =>
					change((p) => {
						p.environments = p.environments.filter((e) => e.id !== env.id);
						for (const output of p.exports)
							if (output.environmentId === env.id) output.environmentId = null;
					}),
				'danger',
			),
		);
	}
	pane.append(
		button(
			'＋ Environment',
			() =>
				change((p) =>
					p.environments.push({ id: id(), name: 'New environment' }),
				),
			'wide quiet',
		),
	);
	heading('Tags');
	const newLabel = field('Tag name', '', () => {});
	newLabel.placeholder = 'Tag name';
	newLabel.setAttribute('aria-label', 'New tag name');

	const newTag = field('Tag identifier', '', () => {});
	newTag.setAttribute('aria-label', 'New tag identifier');
	newTag.placeholder = 'e.g. TEAM_RULES';
	newTag.setAttribute('list', 'tag-suggestions');
	const suggestions = element('datalist');
	suggestions.id = 'tag-suggestions';
	for (const tag of tags) {
		const option = element('option', tag);
		option.value = tag;
		suggestions.append(option);
	}
	pane.append(suggestions);
	pane.append(
		button(
			'＋ Add tag',
			() =>
				change((p) => {
					check(newLabel.value.trim(), 'Give the tag a name');
					const tag = newTag.value.trim().toUpperCase();
					check(
						validTag(tag),
						'Use a tag starting with a letter, then letters, numbers, or underscores',
					);
					const same = p.itemTypes.find((t) => t.tag === tag);
					p.itemTypes.push({
						id: id(),
						label: newLabel.value.trim(),
						tag,
						definition: structuredClone(definition(tag)),
						color:
							same?.color ??
							unusedTagColor(p.itemTypes.map((type) => type.color)),
					});
				}),
			'wide quiet',
		),
	);
	heading('Tags in this project');
	for (const type of editor.project.itemTypes) {
		const row = element('div', undefined, 'tag-definition');
		const color = element('input');
		color.type = 'color';
		color.value = type.color;
		color.setAttribute('aria-label', `${type.label} colour`);
		color.className = 'tag-color';
		color.addEventListener('change', () =>
			change((p) => {
				check(isColor(color.value), 'Invalid colour');
				for (const t of p.itemTypes)
					if (t.tag === type.tag) t.color = color.value;
			}),
		);
		const label = element('input');
		label.value = type.label;
		label.setAttribute('aria-label', `${type.tag} label`);
		label.addEventListener('change', () =>
			change((p) => {
				const t = p.itemTypes.find((t) => t.id === type.id);
				if (t) t.label = label.value;
			}),
		);
		const name = element('label', undefined, 'tag-label');
		name.append(element('span', type.tag), label);
		row.append(color, name);
		pane.append(row);
	}
	deploymentSettings();
}
function deploymentSettings() {
	const pane = get('#inspector');
	heading('Deployment');
	pane.append(
		element(
			'p',
			'One Tale file. Environments are listed in the agent instructions.',
			'small-note',
		),
	);
	pane.append(
		element(
			'p',
			editor.project.exports[0]?.path ?? '.tale/project.tale',
			'small-note',
		),
	);
	const roots = editor.project.diagram.items.filter(
		(item) => itemRole(editor.project, item) === 'document',
	);
	if (roots.length > 1 || editor.project.exports.length > 1) {
		selection(
			'Tale to deploy',
			editor.project.exports.length === 1
				? editor.project.exports[0]!.rootItemId
				: '',
			[
				{ value: '', label: 'Choose a Tale' },
				...roots.map((root) => ({ value: root.id, label: root.title })),
			],
			(rootItemId) =>
				change((project) => {
					check(rootItemId, 'Choose a Tale to deploy');
					project.exports = [
						{
							id: 'project',
							rootItemId,
							environmentId: null,
							path: project.exports[0]?.path ?? '.tale/project.tale',
						},
					];
				}),
		);
	}
}

function previewTales() {
	artifacts = compile(editor.project);
	check(
		artifacts.length,
		'Add a Tale tag and connect your tags before previewing',
	);
	const select = get<HTMLSelectElement>('#artifact-select');
	select.replaceChildren();
	for (const artifact of artifacts) {
		const option = element('option', artifact.path);
		option.value = artifact.path;
		select.append(option);
	}
	showArtifact();
	get<HTMLDialogElement>('#preview').showModal();
}
async function newProject() {
	const document = await openNewProject();
	if (!document) return;
	editor.setProject(document.project);
	saved = '';
	workingPath = null;
	settings = false;
	if (document.project.diagram.items.length) editor.fit();
	refresh(false);
}

async function action(command: MenuAction) {
	if (busy) return;
	setBusy(true);
	get<HTMLDetailsElement>('#file-menu').open = false;
	try {
		switch (command) {
			case 'verify':
				openVerification(structuredClone(editor.project), (ids) => {
					editor.selected = new Set(ids);
					settings = false;
					editor.render();
					refresh(false);
				});
				return;
			case 'exit':
				await reply(window.tale.exit());
				return;
			case 'deploy':
				openDeployment(structuredClone(editor.project), (message) =>
					notify(message),
				);
				return;
			case 'compile':
				previewTales();
				return;
			case 'new':
				await newProject();
				return;
		}
		const result = await reply(
			command === 'open'
				? window.tale.open()
				: window.tale.save(editor.project, command === 'saveAs'),
		);
		if (result.cancelled) return;
		if (result.document) {
			saved = serializeProject(result.document.project);
			workingPath = result.document.path;
			if (command === 'open') editor.setProject(result.document.project);
			await reply(
				window.tale.setDirty(serializeProject(editor.project) !== saved),
			);
			refresh(false);
		}
		if (result.message) notify(result.message);
	} catch (error) {
		notify(error instanceof Error ? error.message : 'Operation failed', true);
	} finally {
		setBusy(false);
	}
}
function showArtifact() {
	get<HTMLTextAreaElement>('#compiled-output').value =
		artifacts.find(
			(a) => a.path === get<HTMLSelectElement>('#artifact-select').value,
		)?.content ?? '';
}
function toolbarIcons() {
	const controls: [string, IconName, string][] = [
		['#undo', 'undo', 'Undo'],
		['#redo', 'redo', 'Redo'],
		['#zoom-in', 'plus', 'Zoom in'],
		['#zoom-out', 'minus', 'Zoom out'],
		['#fit', 'fit', 'Fit diagram'],
		['#select-tool', 'select', 'Select and move'],
		['#hand-tool', 'hand', 'Pan'],
		['#arrow-tool', 'arrow', 'Draw arrow'],
		['#palette > summary', 'plus', 'Add tag'],
		['#close-preview', 'close', 'Close preview'],
		['.appbar > [data-action="save"]', 'save', 'Save'],
		['.appbar > [data-action="exit"]', 'exit', 'Exit Tale'],
		['.appbar > [data-action="compile"]', 'eye', 'Preview Tale'],
	];
	get('.appbar > [data-action="deploy"]').replaceChildren(
		icon('deploy'),
		element('span', 'Deploy Tale'),
	);
	for (const [selector, name, label] of controls)
		decorateIcon(get(selector), name, label);
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
	const select = get<HTMLSelectElement>('#navigation-mode');
	function apply(value: string | null) {
		const mode = navigationMode(value);
		editor.navigation.mode = mode;
		select.value = mode;
		const hints = {
			mouse: 'Right / Space + drag to pan · Wheel or pinch to zoom',
			trackpad: 'Two fingers to pan · Pinch or Ctrl / ⌘ + wheel to zoom',
		};
		get('#navigation-hint').textContent = hints[mode];
		localStorage.setItem('tale.navigation', mode);
	}
	apply(localStorage.getItem('tale.navigation'));
	select.addEventListener('change', () => {
		apply(select.value);
	});
}
async function start() {
	toolbarIcons();
	const result = await reply(window.tale.load());
	check(result.document, 'No project received');
	saved = serializeProject(result.document.project);
	editor = new Editor(get('#canvas'), result.document.project);
	dismissMenus();
	navigationControls();
	editor.onChange = (edited) => {
		if (!edited && editor.selected.size) settings = false;
		refresh(edited);
	};
	editor.onEdit = () => {
		settings = false;
		inspector();
		get<HTMLInputElement>('#inspector input[aria-label="Title"]').focus();
	};
	for (const target of document.querySelectorAll<HTMLButtonElement>(
		'[data-action]',
	))
		target.addEventListener('click', () => {
			void action(target.dataset.action as MenuAction);
		});
	window.tale.onMenu((command) => {
		void action(command);
	});
	for (const tool of ['select', 'hand', 'arrow'] as const)
		get(`#${tool}-tool`).addEventListener('click', () => {
			editor.tool = tool;
			editor.render();
			refresh(false);
		});
	get('#type-search').addEventListener('input', palette);
	for (const name of ['project-settings', 'manage-types'])
		get(`#${name}`).addEventListener('click', () => {
			settings = true;
			get<HTMLDetailsElement>('#palette').open = false;
			inspector();
		});
	get('#undo').addEventListener('click', () => editor.undo());
	get('#redo').addEventListener('click', () => editor.redo());
	get('#zoom-in').addEventListener('click', () => editor.zoom(ui.zoomStep));
	get('#zoom-out').addEventListener('click', () =>
		editor.zoom(1 / ui.zoomStep),
	);
	get('#fit').addEventListener('click', () => editor.fit());
	get('#artifact-select').addEventListener('change', showArtifact);
	get('#close-preview').addEventListener('click', () =>
		get<HTMLDialogElement>('#preview').close(),
	);
	get('#export-tales').addEventListener('click', () => {
		if (busy) return;
		setBusy(true);
		void reply(window.tale.exportTales(editor.project))
			.then((result) => {
				if (result.message) notify(result.message);
			})
			.catch((error) => notify(String(error), true))
			.finally(() => {
				setBusy(false);
			});
	});
	refresh(false);
	document.body.dataset.ready = 'true';
}
void start().catch((error) =>
	notify(error instanceof Error ? error.message : 'Could not start Tale', true),
);
