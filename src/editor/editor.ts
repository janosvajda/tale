import {
	type Definition,
	id,
	type Point,
	type Project,
	validateProject,
} from '../model/project.js';
import { edgeGeometry, MIN_ZOOM, world, zoomAt } from '../svg/geometry.js';
import { Scene } from '../svg/scene.js';
import { Navigation } from './navigation.js';

const interaction = {
	zoomCommitMs: 180,
	duplicateOffset: 32,
	fitMargin: 100,
	minWidth: 160,
	minHeight: 100,
	newWidth: 280,
	newHeight: 180,
};

type Gesture = {
	mode: 'move' | 'pan' | 'resize' | 'connect' | 'bend' | 'reconnect';
	start: Point;
	before: Project;
	node?: string;
	edge?: string;
	handle?: 'from' | 'to';
};
export class Editor {
	project: Project;
	readonly scene: Scene;
	readonly navigation = new Navigation();
	selected = new Set<string>();
	tool: 'select' | 'hand' | 'arrow' = 'select';
	onChange: (edited: boolean) => void = () => {};
	onEdit: () => void = () => {};
	private history: Project[] = [];
	private future: Project[] = [];
	private gesture?: Gesture;
	private space = false;
	private zoomBefore?: Project;
	private zoomTimer?: ReturnType<typeof setTimeout>;
	constructor(host: HTMLElement, project: Project) {
		this.project = structuredClone(project);
		this.scene = new Scene(host);
		const svg = this.scene.element;
		svg.addEventListener('contextmenu', (event) => event.preventDefault());
		svg.addEventListener('pointerdown', (event) => this.down(event));
		svg.addEventListener('pointermove', (event) => this.move(event));
		svg.addEventListener('pointerup', (event) => this.up(event));
		svg.addEventListener('pointercancel', () => {
			if (this.gesture) {
				this.project = this.gesture.before;
				this.gesture = undefined;
				this.render();
			}
		});
		svg.addEventListener(
			'wheel',
			(event) => {
				event.preventDefault();
				this.zoomBefore ??= structuredClone(this.project);
				const rect = svg.getBoundingClientRect();
				this.project.diagram.viewport = this.navigation.scroll(
					this.project.diagram.viewport,
					this.local(event),
					event,
					{ x: rect.width, y: rect.height },
				);
				this.render();
				this.onChange(false);
				clearTimeout(this.zoomTimer);
				this.zoomTimer = setTimeout(() => {
					if (this.zoomBefore) this.commit(this.zoomBefore);
					this.zoomBefore = undefined;
				}, interaction.zoomCommitMs);
			},
			{ passive: false },
		);
		svg.addEventListener('dblclick', (event) => {
			if ((event.target as Element).closest('[data-node]')) this.onEdit();
		});
		svg.addEventListener('keydown', (event) => this.keydown(event));
		svg.addEventListener('keyup', (event) => {
			if (event.code === 'Space') this.space = false;
		});
		svg.addEventListener('blur', () => {
			this.space = false;
		});
		this.render();
	}
	private keydown(event: KeyboardEvent) {
		if (event.code === 'Space') {
			this.space = true;
			event.preventDefault();
			return;
		}
		if (event.key === 'Escape') {
			this.selected.clear();
			this.tool = 'select';
			this.render();
			this.onChange(false);
			return;
		}
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			this.remove();
			return;
		}
		if (!event.metaKey && !event.ctrlKey) return;
		const key = event.key.toLowerCase();
		if (key === 'z') {
			event.preventDefault();
			if (event.shiftKey) this.redo();
			else this.undo();
		}
		if (key === 'd') {
			event.preventDefault();
			this.duplicate();
		}
	}
	private selectNode(node: string, extend: boolean) {
		if (extend) {
			if (this.selected.has(node)) this.selected.delete(node);
			else this.selected.add(node);
		} else if (!this.selected.has(node)) this.selected = new Set([node]);
	}

	setProject(project: Project) {
		validateProject(project);
		clearTimeout(this.zoomTimer);
		this.zoomBefore = undefined;
		this.project = structuredClone(project);
		this.selected.clear();
		this.history = [];
		this.future = [];
		this.render();
		this.onChange(false);
	}
	mutate(action: (project: Project) => void) {
		const before = structuredClone(this.project);
		try {
			action(this.project);
			validateProject(this.project);
			this.commit(before);
		} catch (error) {
			this.project = before;
			throw error;
		}
	}
	private commit(before: Project) {
		if (JSON.stringify(before) === JSON.stringify(this.project)) {
			this.render();
			this.onChange(false);
			return;
		}
		this.history.push(before);
		if (this.history.length > 60) this.history.shift();
		this.future = [];
		this.render();
		this.onChange(true);
	}
	undo() {
		const previous = this.history.pop();
		if (!previous) return;
		this.future.push(this.project);
		this.project = previous;
		this.selected.clear();
		this.render();
		this.onChange(true);
	}
	redo() {
		const next = this.future.pop();
		if (!next) return;
		this.history.push(this.project);
		this.project = next;
		this.selected.clear();
		this.render();
		this.onChange(true);
	}
	add(typeId: string, availableType?: Definition) {
		const rect = this.scene.element.getBoundingClientRect();
		this.addAt(
			typeId,
			{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
			availableType,
		);
	}
	addAt(typeId: string, client: Point, availableType?: Definition) {
		const existing = this.project.definitions.find(
			(type) => type.id === typeId,
		);
		const type = existing ?? availableType;
		if (!type) return;
		const rect = this.scene.element.getBoundingClientRect();
		const position = world(
			{ x: client.x - rect.left, y: client.y - rect.top },
			this.project.diagram.viewport,
		);
		const itemId = id();
		this.mutate((project) => {
			if (!existing) project.definitions.push(structuredClone(type));
			project.diagram.items.push({
				id: itemId,
				definitionId: typeId,
				title: type.name,
				text: type.defaultText,
				position: {
					x: position.x - interaction.newWidth / 2,
					y: position.y - interaction.newHeight / 2,
				},
				size: { width: 280, height: 180 },
			});
		});
		this.selected = new Set([itemId]);
		this.render();
		this.onChange(false);
	}
	remove() {
		if (!this.selected.size) return;
		this.mutate((project) => {
			project.diagram.items = project.diagram.items.filter(
				(i) => !this.selected.has(i.id),
			);
			project.diagram.connections = project.diagram.connections.filter(
				(e) =>
					!this.selected.has(e.id) &&
					!this.selected.has(e.from) &&
					!this.selected.has(e.to),
			);
		});
		this.selected.clear();
		this.onChange(false);
	}
	duplicate() {
		const originals = this.project.diagram.items.filter((item) =>
			this.selected.has(item.id),
		);
		if (!originals.length) return;
		const newIds = new Set<string>();
		this.mutate((project) => {
			for (const item of originals) {
				const copy = structuredClone(item);
				copy.id = id();
				copy.position.x += interaction.duplicateOffset;
				copy.position.y += interaction.duplicateOffset;
				project.diagram.items.push(copy);
				newIds.add(copy.id);
			}
		});
		this.selected = newIds;
		this.render();
		this.onChange(false);
	}
	fit() {
		const items = this.project.diagram.items;
		if (!items.length) return;
		const minX = Math.min(...items.map((i) => i.position.x));
		const minY = Math.min(...items.map((i) => i.position.y));
		const maxX = Math.max(...items.map((i) => i.position.x + i.size.width));
		const maxY = Math.max(...items.map((i) => i.position.y + i.size.height));
		const rect = this.scene.element.getBoundingClientRect();
		this.mutate((p) => {
			const zoom = Math.max(
				MIN_ZOOM,
				Math.min(
					1,
					(rect.width - interaction.fitMargin) / (maxX - minX),
					(rect.height - interaction.fitMargin) / (maxY - minY),
				),
			);
			p.diagram.viewport = {
				x: (rect.width - (maxX - minX) * zoom) / 2 - minX * zoom,
				y: (rect.height - (maxY - minY) * zoom) / 2 - minY * zoom,
				zoom,
			};
		});
	}
	zoom(factor: number) {
		const rect = this.scene.element.getBoundingClientRect();
		this.mutate((p) => {
			p.diagram.viewport = zoomAt(
				p.diagram.viewport,
				{ x: rect.width / 2, y: rect.height / 2 },
				factor,
			);
		});
	}
	private local(event: MouseEvent | WheelEvent): Point {
		const rect = this.scene.element.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}
	private down(event: PointerEvent) {
		if (![0, 1, 2].includes(event.button)) return;
		event.preventDefault();
		this.scene.element.focus();
		const target = event.target as Element;
		const node = target.closest<SVGGElement>('[data-node]')?.dataset.node;
		const edge = target.closest<SVGGElement>('[data-edge]')?.dataset.edge;
		const start = this.local(event);
		const before = structuredClone(this.project);
		if (event.button !== 0 || this.space || this.tool === 'hand')
			this.gesture = { mode: 'pan', start, before };
		else if (
			node &&
			(target.hasAttribute('data-port') || this.tool === 'arrow')
		)
			this.gesture = { mode: 'connect', start, before, node };
		else if (node) {
			this.selectNode(node, event.shiftKey);
			this.gesture = {
				mode: target.hasAttribute('data-resize') ? 'resize' : 'move',
				start,
				before,
				node,
			};
		} else if (edge) {
			this.beginEdge(edge, target, start, before);
		} else {
			this.selected.clear();
			this.gesture = { mode: 'pan', start, before };
		}
		this.scene.element.setPointerCapture(event.pointerId);
		this.render();
		this.onChange(false);
	}
	private beginEdge(
		edge: string,
		target: Element,
		start: Point,
		before: Project,
	) {
		this.selected = new Set([edge]);
		const handle = target.getAttribute('data-handle');
		this.gesture = {
			mode: handle === 'from' || handle === 'to' ? 'reconnect' : 'bend',
			start,
			before,
			edge,
			handle: handle === 'from' ? 'from' : 'to',
		};
	}
	private move(event: PointerEvent) {
		const g = this.gesture;
		if (!g) return;
		const local = this.local(event);
		const dx = (local.x - g.start.x) / g.before.diagram.viewport.zoom;
		const dy = (local.y - g.start.y) / g.before.diagram.viewport.zoom;
		const point = world(local, this.project.diagram.viewport);
		if (g.mode === 'pan') {
			this.project.diagram.viewport.x =
				g.before.diagram.viewport.x + local.x - g.start.x;
			this.project.diagram.viewport.y =
				g.before.diagram.viewport.y + local.y - g.start.y;
		}
		if (g.mode === 'move') this.moveItems(g, dx, dy);
		if (g.mode === 'resize') this.resizeItem(g, dx, dy);
		if (g.mode === 'bend') this.bendEdge(g, dx, dy);
		this.render();
		if (g.mode === 'connect' || g.mode === 'reconnect')
			this.render({
				start: world(g.start, this.project.diagram.viewport),
				end: point,
			});
	}
	private moveItems(g: Gesture, dx: number, dy: number) {
		for (const item of this.project.diagram.items) {
			const before = g.before.diagram.items.find((i) => i.id === item.id);
			if (before && this.selected.has(item.id))
				item.position = {
					x: before.position.x + dx,
					y: before.position.y + dy,
				};
		}
	}
	private resizeItem(g: Gesture, dx: number, dy: number) {
		const item = this.project.diagram.items.find((i) => i.id === g.node);
		const original = g.before.diagram.items.find((i) => i.id === g.node);
		if (item && original)
			item.size = {
				width: Math.max(interaction.minWidth, original.size.width + dx),
				height: Math.max(interaction.minHeight, original.size.height + dy),
			};
	}
	private bendEdge(g: Gesture, dx: number, dy: number) {
		const edge = this.project.diagram.connections.find((e) => e.id === g.edge);
		const original = g.before.diagram.connections.find((e) => e.id === g.edge);
		const from = g.before.diagram.items.find((i) => i.id === original?.from);
		const to = g.before.diagram.items.find((i) => i.id === original?.to);
		if (edge && original && from && to) {
			const control = edgeGeometry(
				{ ...from.position, ...from.size },
				{ ...to.position, ...to.size },
				original.bend,
			).control;
			edge.bend = { x: control.x + dx, y: control.y + dy };
		}
	}

	private up(event: PointerEvent) {
		const g = this.gesture;
		if (!g) return;
		const point = world(this.local(event), this.project.diagram.viewport);
		const hit = [...this.project.diagram.items]
			.reverse()
			.find(
				(i) =>
					point.x >= i.position.x &&
					point.x <= i.position.x + i.size.width &&
					point.y >= i.position.y &&
					point.y <= i.position.y + i.size.height,
			);
		if (g.mode === 'connect' && hit && g.node) {
			const siblings = this.project.diagram.connections.filter(
				(e) => e.from === g.node,
			);
			const edgeId = id();
			this.project.diagram.connections.push({
				id: edgeId,
				from: g.node,
				to: hit.id,
				order: siblings.length
					? Math.max(...siblings.map((e) => e.order)) + 1
					: 0,
			});
			this.selected = new Set([edgeId]);
			this.tool = 'select';
		}
		if (g.mode === 'reconnect' && hit && g.handle) {
			const edge = this.project.diagram.connections.find(
				(e) => e.id === g.edge,
			);
			if (edge) edge[g.handle] = hit.id;
		}
		this.gesture = undefined;
		this.scene.element.releasePointerCapture(event.pointerId);
		this.commit(g.before);
	}
	render(preview?: { start: Point; end: Point }) {
		const types = new Map(this.project.definitions.map((t) => [t.id, t]));
		this.scene.draw(
			this.project.diagram.items.map((item) => ({
				id: item.id,
				box: { ...item.position, ...item.size },
				title: item.title,
				badge: types.get(item.definitionId)?.name ?? 'Unknown',
				color: types.get(item.definitionId)?.color ?? '#475569',
				lines: item.text.split('\n').filter(Boolean),
			})),
			this.project.diagram.connections,
			this.project.diagram.viewport,
			this.selected,
			preview,
		);
		this.scene.element.dataset.tool = this.tool;
	}
}
