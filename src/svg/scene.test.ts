// @browser-test
import { Scene } from './scene.js';
export function run() {
	const host = document.createElement('div');
	document.body.append(host);
	try {
		const scene = new Scene(host);
		scene.draw(
			[
				{
					id: 'unsafe',
					box: { x: 0, y: 0, width: 260, height: 180 },
					title: '<img src=x onerror=alert(1)>',
					badge: 'GOAL',
					color: '#123456',
					lines: ['Readable summary'],
				},
			],
			[],
			{ x: 0, y: 0, zoom: 1 },
			new Set(['unsafe']),
		);
		if (host.querySelector('img'))
			throw new Error('Project text became markup');
		if (!host.textContent?.includes('<img'))
			throw new Error('Project text was lost');
		if (!host.querySelector('[data-resize="unsafe"]'))
			throw new Error('Selected objects need resize handles');
		if (!host.querySelector('[data-port="unsafe"]'))
			throw new Error('Objects need precise connection handles');
		const remove = host.querySelector('[data-delete="unsafe"]');
		if (
			remove?.getAttribute('aria-label') !==
			'Delete <img src=x onerror=alert(1)>'
		)
			throw new Error('Each box needs an accessible delete control');
	} finally {
		host.remove();
	}
}
