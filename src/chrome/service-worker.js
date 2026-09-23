const editor = 'ui/index.html';

chrome.action.onClicked.addListener(async () => {
	const url = chrome.runtime.getURL(editor);
	const pages = await self.clients.matchAll({
		type: 'window',
		includeUncontrolled: true,
	});
	const existing = pages.find((page) => page.url === url);
	if (existing) {
		await existing.focus();
		return;
	}
	await chrome.tabs.create({ url });
});
