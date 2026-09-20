// @browser-test
import { world } from '../svg/geometry.js';
import { Navigation, navigationMode, type ScrollInput } from './navigation.js';

const view = { x: 20, y: 40, zoom: 0.7 };
const anchor = { x: 320, y: 240 };
const page = { x: 960, y: 680 };
const event: ScrollInput = {
	deltaX: 0,
	deltaY: 100,
	deltaMode: 0,
	ctrlKey: false,
	metaKey: false,
	shiftKey: false,
};
const assert = {
	ok(condition: boolean, message = 'Unexpected navigation result') {
		if (!condition) throw new Error(message);
	},
	equal(actual: number, expected: number) {
		if (actual !== expected)
			throw new Error(`Expected ${expected}, got ${actual}`);
	},
	deepEqual(actual: object, expected: object) {
		if (JSON.stringify(actual) !== JSON.stringify(expected))
			throw new Error('Unexpected viewport');
	},
};
function mouseAndTrackpad() {
	const navigation = new Navigation();
	navigation.mode = 'mouse';
	const zoomed = navigation.scroll(view, anchor, event, page);
	assert.ok(zoomed.zoom < view.zoom);
	const before = world(anchor, view);
	const after = world(anchor, zoomed);
	const tolerance = 1e-9;
	assert.ok(Math.abs(before.x - after.x) < tolerance);
	assert.ok(Math.abs(before.y - after.y) < tolerance);
	navigation.mode = 'trackpad';
	assert.deepEqual(navigation.scroll(view, anchor, event, page), {
		...view,
		y: -60,
	});
	assert.deepEqual(
		navigation.scroll(view, anchor, { ...event, shiftKey: true }, page),
		{ ...view, x: -80 },
	);
	assert.deepEqual(
		navigation.scroll(view, anchor, { ...event, deltaX: 10 }, page),
		{ ...view, x: 10, y: -60 },
	);
	for (const modifier of ['ctrlKey', 'metaKey'])
		assert.ok(
			navigation.scroll(view, anchor, { ...event, [modifier]: true }, page)
				.zoom < view.zoom,
		);
}
function preferences() {
	assert.ok(navigationMode(null) === 'mouse', 'New users must get wheel zoom');
	assert.ok(
		navigationMode('auto') === 'mouse',
		'Old Auto preferences must migrate to wheel zoom',
	);
	assert.ok(navigationMode('mouse') === 'mouse');
	assert.ok(
		navigationMode('trackpad') === 'trackpad',
		'Preserve an explicit trackpad preference',
	);
}
function recordedMouseWheel() {
	const navigation = new Navigation();
	// Captured from the user's physical mouse on the board. These inputs were
	// previously misclassified as a trackpad, leaving zoom unchanged at 70%.
	const captured = [
		{ deltaX: 0, deltaY: 1, wheelDeltaY: -3 },
		{ deltaX: 0, deltaY: 2, wheelDeltaY: -6 },
		{ deltaX: 1, deltaY: 6, wheelDeltaY: -18 },
		{ deltaX: 2, deltaY: 12, wheelDeltaY: -36 },
		{ deltaX: 3, deltaY: 13, wheelDeltaY: -39 },
		{ deltaX: 3, deltaY: 16, wheelDeltaY: -48 },
		{ deltaX: 0, deltaY: 13, wheelDeltaY: -39 },
	];
	for (const sample of captured) {
		const input = { ...event, ...sample };
		const out = navigation.scroll(view, anchor, input, page);
		assert.ok(out.zoom < view.zoom, 'Captured mouse wheel must zoom out');
		const back = navigation.scroll(
			out,
			anchor,
			{ ...input, deltaY: -input.deltaY },
			page,
		);
		const tolerance = 1e-9;
		assert.ok(
			Math.abs(back.zoom - view.zoom) < tolerance,
			'Reverse wheel must zoom back in',
		);
	}
	navigation.mode = 'trackpad';
	for (const sample of captured)
		assert.equal(
			navigation.scroll(view, anchor, { ...event, ...sample }, page).zoom,
			view.zoom,
		);
}
function deltaUnits() {
	const navigation = new Navigation();
	navigation.mode = 'trackpad';
	const line = navigation.scroll(
		view,
		anchor,
		{ ...event, deltaMode: 1, deltaY: 1 },
		page,
	);
	assert.equal(line.y, 24);
	const paged = navigation.scroll(
		view,
		anchor,
		{ ...event, deltaMode: 2, deltaY: 1 },
		page,
	);
	assert.equal(paged.y, view.y - page.y);
}
export function run() {
	mouseAndTrackpad();
	preferences();
	recordedMouseWheel();
	deltaUnits();
}
