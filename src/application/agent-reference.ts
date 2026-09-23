import type { ReferencePlacement } from '../model/deployment.js';

const start = '<!-- tale:project:start -->';
const end = '<!-- tale:project:end -->';

function bounds(content: string): { first: number; last: number } | null {
	const first = content.indexOf(start);
	const last = content.indexOf(end);
	if (first < 0 && last < 0) return null;
	if (
		first < 0 ||
		last < first ||
		content.indexOf(start, first + start.length) >= 0 ||
		content.indexOf(end, last + end.length) >= 0
	)
		throw new Error(
			'The existing Tale reference is ambiguous. Resolve its markers before deploying.',
		);
	return { first, last };
}

export function hasUnmanagedTaleInstruction(
	content: string,
	paths: string[],
): boolean {
	const found = bounds(content);
	const unmanaged = found
		? content.slice(0, found.first) + content.slice(found.last + end.length)
		: content;
	let inCode = false;
	for (const line of unmanaged.replaceAll('\r\n', '\n').split('\n')) {
		const trimmed = line.trim();
		if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
			inCode = !inCode;
			continue;
		}
		if (
			!inCode &&
			trimmed.toLowerCase().includes('read') &&
			paths.some((path) => trimmed.includes(path))
		)
			return true;
	}
	return false;
}

export function withoutManagedReference(content: string): string {
	const found = bounds(content);
	if (!found) return content;
	const before = content.slice(0, found.first);
	const after = content.slice(found.last + end.length);
	const newline = content.includes('\r\n') ? '\r\n' : '\n';
	if (!after.trim() && before.endsWith(newline + newline))
		return before.slice(0, -newline.length);
	return before + after;
}

function atBeginning(content: string, block: string, newline: string): string {
	const opening = `---${newline}`;
	const closing = `${newline}---${newline}`;
	const header = content.startsWith(opening)
		? content.indexOf(closing, opening.length)
		: -1;
	const insertAt = header < 0 ? 0 : header + closing.length;
	const prefix = content.slice(0, insertAt);
	const rest = content.slice(insertAt);
	return `${prefix}${block}${newline}${rest ? newline + rest : ''}`;
}

export function agentReference(
	content: string,
	instructions?: string,
	placement: ReferencePlacement = 'end',
): string {
	const newline = content.includes('\r\n') ? '\r\n' : '\n';
	const block = [
		start,
		(
			instructions ??
			'Before working in this project, read .tale/project.tale and follow its agreements. If it cannot be read, report that before implementation.'
		)
			.replaceAll('\r\n', '\n')
			.split('\n')
			.join(newline),
		end,
	].join(newline);
	const found = bounds(content);
	if (!found && placement === 'beginning')
		return atBeginning(content, block, newline);
	if (!found)
		return `${content}${content.length ? (content.endsWith('\n') ? newline : newline + newline) : ''}${block}${newline}`;
	return (
		content.slice(0, found.first) +
		block +
		content.slice(found.last + end.length)
	);
}
