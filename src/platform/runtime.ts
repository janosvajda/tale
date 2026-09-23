import type { Bridge } from '../model/bridge.js';
import { createChromeBridge } from './chrome.js';

let chromeBridge: Bridge | undefined;

export function applicationBridge(): Bridge {
	if (window.tale) return window.tale;
	if (location.protocol === 'chrome-extension:')
		return (chromeBridge ??= createChromeBridge());
	throw new Error('Tale has no application platform');
}
