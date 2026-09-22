// @browser-test
import { decorateIcon, iconButton } from './icons.js';
export function run() {
	let clicks = 0;
	const button = iconButton('duplicate', 'Duplicate item', () => {
		clicks++;
	});
	if (button.textContent || !button.querySelector('svg path'))
		throw new Error('Actions must use drawn SVG icons');
	if (
		button.getAttribute('aria-label') !== 'Duplicate item' ||
		button.title !== 'Duplicate item'
	)
		throw new Error('Icons need accessible names and tooltips');
	if (button.querySelector('svg')?.getAttribute('aria-hidden') !== 'true')
		throw new Error('Decorative SVG must not duplicate accessible labels');
	button.click();
	if (clicks !== 1) throw new Error('Icon button lost its action');
	decorateIcon(button, 'trash', 'Delete item');
	if (
		button.querySelectorAll('svg').length !== 1 ||
		button.getAttribute('title') !== 'Delete item'
	)
		throw new Error('Replacing an icon must not accumulate markup');
}
