import type { Point, Viewport } from '../model/project.js';
import { zoomAt } from '../svg/geometry.js';

export type NavigationMode = 'mouse' | 'trackpad';
export function navigationMode(saved: string | null): NavigationMode {
	return saved === 'trackpad' ? 'trackpad' : 'mouse';
}
export interface ScrollInput {
	deltaX: number;
	deltaY: number;
	deltaMode: number;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}
const scrolling = {
	linePixels: 16,
	wheelSensitivity: 0.002,
	pinchSensitivity: 0.01,
};

// Smooth mice and trackpads can produce identical wheel events. The user's
// navigation preference, never a guess from event deltas, defines their meaning.
export class Navigation {
	mode: NavigationMode = 'mouse';
	scroll(
		view: Viewport,
		anchor: Point,
		event: ScrollInput,
		page: Point,
	): Viewport {
		const modified = event.ctrlKey || event.metaKey;
		const dx = event.deltaX * this.unit(event.deltaMode, page.x);
		const dy = event.deltaY * this.unit(event.deltaMode, page.y);
		if (modified || this.mode === 'mouse')
			return zoomAt(
				view,
				anchor,
				Math.exp(
					-dy *
						(modified
							? scrolling.pinchSensitivity
							: scrolling.wheelSensitivity),
				),
			);
		return {
			...view,
			x: view.x - (event.shiftKey && !dx ? dy : dx),
			y: view.y - (event.shiftKey && !dx ? 0 : dy),
		};
	}
	private unit(mode: number, page: number) {
		if (mode === 1) return scrolling.linePixels;
		return mode === 2 ? page : 1;
	}
}
