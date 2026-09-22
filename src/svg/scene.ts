import {
	type Box,
	edgeGeometry,
	type Point,
	type Viewport,
} from './geometry.js';

const layout = {
	handleRadius: 7,
	portRadius: 6,
	accentInset: 24,
	minimumAccentHeight: 20,
	padding: 36,
	titleCharWidth: 8,
	detailCharWidth: 6.8,
	maxLines: 5,
	detailsHeight: 85,
	lineHeight: 23,
	detailY: 83,
	deleteRightInset: 32,
};

export function svg<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attributes: Record<string, string | number> = {},
	text?: string,
): SVGElementTagNameMap[K] {
	const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const [key, value] of Object.entries(attributes))
		element.setAttribute(key, String(value));
	if (text !== undefined) element.textContent = text;
	return element;
}
export interface SceneNode {
	id: string;
	box: Box;
	title: string;
	badge: string;
	color: string;
	lines: string[];
}
export interface SceneEdge {
	label?: string;
	id: string;
	from: string;
	to: string;
	bend?: Point;
}
export class Scene {
	readonly element = svg('svg', {
		class: 'board',
		tabindex: '0',
		role: 'application',
		'aria-label': 'Diagram editor',
	});
	readonly layer = svg('g');
	constructor(host: HTMLElement) {
		const defs = svg('defs');
		const marker = svg('marker', {
			id: 'arrow',
			markerWidth: 9,
			markerHeight: 9,
			refX: 8,
			refY: 4.5,
			orient: 'auto',
			markerUnits: 'userSpaceOnUse',
		});
		marker.append(svg('path', { d: 'M0,0 L9,4.5 L0,9 Z', fill: '#8491a2' }));
		defs.append(marker);
		this.element.append(defs, this.layer);
		host.append(this.element);
	}
	draw(
		nodes: SceneNode[],
		edges: SceneEdge[],
		viewport: Viewport,
		selected: Set<string>,
		preview?: { start: Point; end: Point },
	) {
		this.layer.replaceChildren();
		this.layer.setAttribute(
			'transform',
			`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`,
		);
		const boxes = new Map(nodes.map((node) => [node.id, node.box]));
		const handles = svg('g');
		for (const edge of edges) {
			const a = boxes.get(edge.from);
			const b = boxes.get(edge.to);
			if (!a || !b) continue;
			const geometry = edgeGeometry(a, b, edge.bend);
			const group = svg('g', {
				'data-edge': edge.id,
				class: selected.has(edge.id) ? 'edge selected' : 'edge',
			});
			group.append(
				svg('path', { d: geometry.path, class: 'edge-hit' }),
				svg('path', {
					d: geometry.path,
					class: 'edge-line',
					'marker-end': 'url(#arrow)',
				}),
			);
			if (edge.label)
				group.append(
					svg(
						'text',
						{
							x: geometry.control.x,
							y: geometry.control.y,
							class: 'edge-label',
						},
						edge.label,
					),
				);
			this.layer.append(group);
			if (selected.has(edge.id)) {
				for (const [handle, point] of [
					['bend', geometry.control],
					['from', geometry.start],
					['to', geometry.end],
				] as const)
					handles.append(
						svg('circle', {
							cx: point.x,
							cy: point.y,
							r: layout.handleRadius / viewport.zoom,
							class: 'edge-handle',
							'data-edge': edge.id,
							'data-handle': handle,
						}),
					);
			}
		}
		for (const node of nodes)
			this.layer.append(this.drawNode(node, viewport, selected));
		this.layer.append(handles);
		if (preview)
			this.layer.append(
				svg('path', {
					d: `M${preview.start.x},${preview.start.y} L${preview.end.x},${preview.end.y}`,
					class: 'connection-preview',
				}),
			);
	}
	private drawNode(
		node: SceneNode,
		viewport: Viewport,
		selected: Set<string>,
	): SVGGElement {
		const { box } = node;
		const group = svg('g', {
			transform: `translate(${box.x} ${box.y})`,
			'data-node': node.id,
			class: selected.has(node.id) ? 'node selected' : 'node',
			role: 'button',
			'aria-label': node.title,
		});
		group.append(
			svg('rect', {
				width: box.width,
				height: box.height,
				rx: 10,
				class: 'node-body',
			}),
		);
		group.append(
			svg('rect', {
				x: 0,
				y: 12,
				width: 4,
				height: Math.max(
					layout.minimumAccentHeight,
					box.height - layout.accentInset,
				),
				rx: 2,
				fill: node.color,
			}),
		);
		const cut = (text: string, size: number) =>
			text.length > size ? `${text.slice(0, size - 1)}…` : text;
		group.append(
			svg(
				'text',
				{ x: 18, y: 26, class: 'node-tag', fill: node.color },
				node.badge,
			),
		);
		group.append(
			svg(
				'text',
				{ x: 18, y: 53, class: 'node-title' },
				cut(
					node.title,
					Math.floor((box.width - layout.padding) / layout.titleCharWidth),
				),
			),
		);
		node.lines
			.slice(
				0,
				Math.max(
					0,
					Math.min(
						layout.maxLines,
						Math.floor((box.height - layout.detailsHeight) / layout.lineHeight),
					),
				),
			)
			.forEach((line, index) => {
				group.append(
					svg(
						'text',
						{
							x: 18,
							y: layout.detailY + index * layout.lineHeight,
							class: 'node-detail',
						},
						cut(
							line,
							Math.floor((box.width - layout.padding) / layout.detailCharWidth),
						),
					),
				);
			});
		group.append(
			svg('circle', {
				cx: box.width,
				cy: box.height / 2,
				r: layout.portRadius / viewport.zoom,
				class: 'port',
				'data-port': node.id,
			}),
		);
		const remove = svg('g', {
			class: 'node-delete',
			'data-delete': node.id,
			role: 'button',
			tabindex: '0',
			'aria-label': `Delete ${node.title}`,
			transform: `translate(${box.width - layout.deleteRightInset} 8)`,
		});
		remove.append(
			svg('title', {}, `Delete ${node.title}`),
			svg('rect', { width: 24, height: 24, rx: 4 }),
			svg('path', {
				d: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7',
			}),
		);
		group.append(remove);
		if (selected.has(node.id))
			group.append(
				svg('rect', {
					x: box.width - 10 / viewport.zoom,
					y: box.height - 10 / viewport.zoom,
					width: 10 / viewport.zoom,
					height: 10 / viewport.zoom,
					class: 'resize',
					'data-resize': node.id,
				}),
			);
		return group;
	}
}
