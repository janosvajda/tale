// @browser-test
function selectProduct() {
	const product = document.querySelector('[data-node="product"] .node-body');
	if (!product) throw new Error('Missing Product card');
	product.dispatchEvent(
		new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }),
	);
	product.dispatchEvent(
		new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }),
	);
}
function check(condition: unknown, message: string) {
	if (!condition) throw new Error(message);
}
function press(label: string) {
	const action = [
		...document.querySelectorAll<HTMLButtonElement>('#inspector button'),
	].find(
		(button) =>
			button.textContent === label ||
			button.getAttribute('aria-label') === label,
	);
	check(action, `Missing action: ${label}`);
	action?.click();
}
function undo() {
	document.querySelector<HTMLButtonElement>('#undo')?.click();
	selectProduct();
}
function sectionActions() {
	const count = document.querySelectorAll('.node').length;
	press('Delete Supported platforms');
	check(
		!document.querySelector('[data-section="platforms"]'),
		'Delete must remove only the named section',
	);
	check(
		document.querySelectorAll('.node').length === count,
		'Deleting a section must not delete its item',
	);
	check(
		document.querySelector('[data-section="editor"]'),
		'Neighbouring sections must survive deletion',
	);
	undo();
	press('Duplicate tag');
	check(
		document.querySelectorAll('.node').length === count + 1,
		'Duplicate tag must create one copy',
	);
	undo();
	press('Delete tag');
	check(
		!document.querySelector('[data-node="product"]'),
		'Delete tag must target the displayed item',
	);
	check(
		document.querySelector('[data-node="goal"]'),
		'Delete tag must preserve other items',
	);
	undo();
}
function persistentActions() {
	const content = document.querySelector<HTMLElement>('.inspector-content');
	const toolbar = document.querySelector('.section-toolbar');
	check(
		content && toolbar,
		'Inspector needs fixed section tools and separate scrolling content',
	);
	if (!content || !toolbar) return;
	const before = toolbar.getBoundingClientRect();
	content.scrollTop = content.scrollHeight;
	const after = toolbar.getBoundingClientRect();
	check(
		before.top === after.top && after.bottom <= innerHeight,
		'Add section must remain visible while scrolling',
	);
	check(
		document.querySelector('.inspector-header')?.getBoundingClientRect().top ===
			document.querySelector('#inspector')?.getBoundingClientRect().top,
		'Item actions must remain fixed',
	);
	content.scrollTop = 0;
}
function menus() {
	const file = document.querySelector<HTMLDetailsElement>('#file-menu')!;
	const palette = document.querySelector<HTMLDetailsElement>('#palette')!;
	file.open = true;
	file
		.querySelector('.menu')!
		.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	check(file.open, 'Interacting inside the menu must leave it open');
	selectProduct();
	check(!file.open, 'Clicking a board item must close File');
	palette.open = true;
	document
		.querySelector('#type-search')!
		.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	check(palette.open, 'Palette search must remain usable');
	const board = document.querySelector('.board')!;
	board.dispatchEvent(
		new PointerEvent('pointerdown', {
			bubbles: true,
			button: 0,
			pointerId: 1,
		}),
	);
	board.dispatchEvent(
		new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }),
	);
	check(!palette.open, 'Clicking the empty board must close the palette');
	file.open = true;
	document.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
	);
	check(!file.open, 'Escape must dismiss File');
	check(
		file.querySelector('[data-action="save"]')?.textContent?.includes('Save'),
		'File menu actions need visible labels',
	);
}
function paletteBounds() {
	const palette = document.querySelector<HTMLDetailsElement>('#palette')!;
	palette.open = true;
	const panel = palette
		.querySelector('.palette-panel')!
		.getBoundingClientRect();
	const canvas = document.querySelector('#canvas')!.getBoundingClientRect();
	check(
		panel.left >= canvas.left && panel.right <= canvas.right,
		'Add tag menu must stay within the board horizontally',
	);
	check(
		panel.top >= 0 && panel.bottom <= innerHeight,
		'Add tag menu must stay within the window vertically',
	);
	palette.open = false;
}
function tagSettings() {
	document.querySelector<HTMLButtonElement>('#manage-types')!.click();
	const pane = document.querySelector<HTMLElement>('#inspector')!;
	const text = pane.textContent ?? '';
	check(
		!text.includes('Item types') && !text.includes('Tale outputs'),
		'Settings must use tag terminology and a single Tale file',
	);
	check(
		!text.includes('Remove output') && !text.includes('＋ Tale output'),
		'Settings must not offer arbitrary additional files',
	);
	const name = pane.querySelector<HTMLInputElement>(
		'[aria-label="New tag name"]',
	)!;
	const identifier = pane.querySelector<HTMLInputElement>(
		'[aria-label="New tag identifier"]',
	)!;
	name.focus();
	check(
		name.getBoundingClientRect().bottom <
			identifier.getBoundingClientRect().top,
		'New tag fields must be separated',
	);
	const rows = [...pane.querySelectorAll<HTMLElement>('.tag-definition')];
	let previousBottom = 0;
	for (const row of rows) {
		const input = row.querySelector<HTMLInputElement>('.tag-label input')!;
		input.focus();
		const bounds = row.getBoundingClientRect();
		const top = row.offsetTop;
		check(top > previousBottom, 'Tag rows need space for focus outlines');
		previousBottom = top + bounds.height;
		check(
			input.getBoundingClientRect().right <= pane.getBoundingClientRect().right,
			'Tag inputs must stay within the inspector',
		);
	}
	press('Close inspector');
}
export function run() {
	const deploy = document.querySelector<HTMLButtonElement>(
		'.appbar > [data-action="deploy"]',
	);
	check(
		deploy?.textContent === 'Deploy Tale' && deploy.querySelector('svg'),
		'Deploy has a visible label and icon',
	);
	check(
		deploy && getComputedStyle(deploy).backgroundColor === 'rgb(21, 128, 61)',
		'Deploy is green',
	);
	check(
		document.querySelector('.appbar > [data-action="exit"] svg'),
		'Exit icon is visible',
	);
	check(
		document.querySelector('#file-menu [data-action="exit"]')?.textContent ===
			'Exit',
		'Exit is in the File menu',
	);
	menus();
	paletteBounds();
	tagSettings();
	selectProduct();
	sectionActions();
	persistentActions();
	const pane = document.querySelector('#inspector');
	const windows = pane?.querySelector<HTMLInputElement>(
		'input[aria-label="Supported platforms: Windows"]',
	);
	if (!windows?.checked)
		throw new Error('App must show the saved platform selections');
	if (pane?.querySelector('textarea'))
		throw new Error('Product editing must not expose JSON textareas');
	const style = pane?.querySelector<HTMLSelectElement>(
		'select[aria-label="Editor style"]',
	);
	if (style?.selectedOptions[0]?.textContent !== 'Freeform board')
		throw new Error('Editor style must have a readable label');
	const connections = document.querySelector<HTMLDetailsElement>(
		'[data-section="connections"]',
	);
	if (connections) connections.open = true;
	windows.click();
	check(
		document.querySelector<HTMLDetailsElement>('[data-section="connections"]')
			?.open,
		'Editing must preserve expanded sections',
	);
	const details =
		document.querySelector('[data-node="product"]')?.textContent ?? '';
	if (
		details.includes('Windows') ||
		details.includes('["') ||
		details.includes('miro_style')
	)
		throw new Error('Card must reflect readable edited values');
}
