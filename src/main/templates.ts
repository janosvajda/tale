import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
	fromTemplate,
	type NewProjectRequest,
	type TemplateSummary,
} from '../model/new-project.js';
import { check } from '../model/project.js';
import { readProject } from './files.js';

async function templateFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
		.map((entry) => entry.name)
		.sort();
}
export async function listTemplates(
	directory: string,
): Promise<TemplateSummary[]> {
	const files = await templateFiles(directory);
	return Promise.all(
		files.map(async (id) => ({
			id,
			name: (await readProject(join(directory, id))).name,
		})),
	);
}
export async function createFromTemplate(
	directory: string,
	request: NewProjectRequest,
) {
	check(
		(await templateFiles(directory)).includes(request.templateId),
		'Unknown Tale template',
	);
	return fromTemplate(
		await readProject(join(directory, request.templateId)),
		request,
	);
}
