export const MIN_ZOOM = 0.12;
const MAX_ZOOM = 3;
const LOOP_OFFSET = 160;
export interface Point {
	x: number;
	y: number;
}
export interface Viewport extends Point {
	zoom: number;
}
export interface Box extends Point {
	width: number;
	height: number;
}
export function world(point: Point, view: Viewport): Point {
	return {
		x: (point.x - view.x) / view.zoom,
		y: (point.y - view.y) / view.zoom,
	};
}
export function zoomAt(view: Viewport, point: Point, factor: number): Viewport {
	const anchor = world(point, view);
	const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
	return { x: point.x - anchor.x * zoom, y: point.y - anchor.y * zoom, zoom };
}
export function center(box: Box): Point {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export function boundary(box: Box, toward: Point): Point {
	const c = center(box);
	const dx = toward.x - c.x;
	const dy = toward.y - c.y;
	if (!dx && !dy) return { x: c.x, y: box.y };
	const scale =
		1 /
		Math.max(Math.abs(dx) / (box.width / 2), Math.abs(dy) / (box.height / 2));
	return { x: c.x + dx * scale, y: c.y + dy * scale };
}
export function edgeGeometry(
	a: Box,
	b: Box,
	bend?: Point,
): { start: Point; end: Point; control: Point; path: string } {
	const ac = center(a);
	const bc = center(b);
	const self =
		a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
	const control =
		bend ??
		(self
			? { x: a.x + a.width + LOOP_OFFSET, y: a.y - LOOP_OFFSET }
			: { x: (ac.x + bc.x) / 2, y: (ac.y + bc.y) / 2 });
	const start = self ? { x: a.x + a.width, y: ac.y } : boundary(a, bend ?? bc);
	const end = self ? { x: ac.x, y: a.y } : boundary(b, bend ?? ac);
	return {
		start,
		end,
		control,
		path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
	};
}
