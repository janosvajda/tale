const fixtureValues = {
	extremeZoomIn: 100,
	extremeZoomOut: 0.00001,
};

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { edgeGeometry, world, zoomAt } from './geometry.js';

test('self loops have distinct boundary endpoints and zoom clamps preserve the pointer anchor', () => {
	const box = { x: 10, y: 20, width: 100, height: 80 };
	const loop = edgeGeometry(box, box);
	assert.deepEqual(loop.start, { x: 110, y: 60 });
	assert.deepEqual(loop.end, { x: 60, y: 20 });
	const view = { x: 10, y: 20, zoom: 1 },
		pointer = { x: 60, y: 80 };
	assert.deepEqual(
		world(pointer, zoomAt(view, pointer, fixtureValues.extremeZoomIn)),
		world(pointer, view),
	);
	assert.ok(zoomAt(view, pointer, fixtureValues.extremeZoomOut).zoom > 0);
});
