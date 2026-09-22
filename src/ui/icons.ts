import { svg } from '../svg/scene.js';

const paths = {
	folder: 'M3 6h6l2 2h10v12H3zM3 6V4h6l2 2h10v2',
	plus: 'M12 5v14M5 12h14',
	info: 'M12 17v-5M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
	warning: 'M12 3 2 21h20L12 3ZM12 9v5M12 18h.01',
	trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
	duplicate: 'M3 4h12v5M9 16H3V4M9 9h12v12H9zM15 12v6M12 15h6',
	edit: 'M4 20h4L20 8l-4-4L4 16v4M13 7l4 4',
	close: 'M6 6l12 12M18 6L6 18',
	up: 'M5 12l7-7 7 7M12 5v15',
	undo: 'M8 4L3 9l5 5M3 9h10a7 7 0 0 1 0 14',
	redo: 'M16 4l5 5-5 5M21 9H11a7 7 0 0 0 0 14',
	minus: 'M5 12h14',
	fit: 'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
	select: 'M5 3l14 10-7 1-3 7z',
	hand: 'M8 11V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v10c0 5-3 7-7 7-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l2 2',
	arrow: 'M4 20L20 4M10 4h10v10',
	save: 'M4 3h13l4 4v14H3V3h1M7 3v7h10V3M7 21v-7h10v7',
	exit: 'M10 4H4v16h6M9 12h12M16 7l5 5-5 5',
	deploy: 'M12 16V3M7 8l5-5 5 5M4 14v7h16v-7',
	eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
};
export type IconName = keyof typeof paths;
export function icon(name: IconName): SVGSVGElement {
	const node = svg('svg', {
		viewBox: '0 0 24 24',
		width: 18,
		height: 18,
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 1.7,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'aria-hidden': 'true',
		focusable: 'false',
		class: 'ui-icon',
	});
	node.append(svg('path', { d: paths[name] }));
	return node;
}
export function decorateIcon(
	node: HTMLElement,
	name: IconName,
	label: string,
): void {
	node.replaceChildren(icon(name));
	node.title = label;
	node.setAttribute('aria-label', label);
	node.classList.add('icon-button');
}
export function iconButton(
	name: IconName,
	label: string,
	action: () => void,
): HTMLButtonElement {
	const node = document.createElement('button');
	node.type = 'button';
	decorateIcon(node, name, label);
	node.addEventListener('click', action);
	return node;
}
