import { catalogue, itemRole } from './catalogue.js';
import {
	check,
	type ItemType,
	id,
	type Project,
	record,
	text,
	validateDirectory,
} from './project.js';

export function newProject(itemTypes: ItemType[] = catalogue.tags): Project {
	return {
		format: 'tale-project',
		formatVersion: 1,
		id: id(),
		name: 'Untitled',
		environments: [],
		itemTypes: structuredClone(itemTypes),
		diagram: { items: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 } },
		exports: [],
	};
}

export interface NewProjectRequest {
	templateId: string;
	title: string;
	deploymentDirectory?: string;
}
export interface TemplateSummary {
	id: string;
	name: string;
}
export function validateNewProject(
	value: unknown,
): asserts value is NewProjectRequest {
	check(record(value), 'Invalid new-project request');
	check(
		Object.keys(value).every((key) =>
			['templateId', 'title', 'deploymentDirectory'].includes(key),
		),
		'Unexpected new-project field',
	);
	text(value.templateId, 'template');
	text(value.title, 'project title');
	if (value.deploymentDirectory !== undefined)
		validateDirectory(value.deploymentDirectory);
}
export function fromTemplate(
	template: Project,
	request: NewProjectRequest,
): Project {
	validateNewProject(request);
	const project = structuredClone(template);
	project.id = id();
	project.name = request.title.trim();
	if (request.deploymentDirectory)
		project.deploymentDirectory = request.deploymentDirectory.trim();
	else Reflect.deleteProperty(project, 'deploymentDirectory');
	for (const item of project.diagram.items)
		if (itemRole(project, item) === 'document') item.title = project.name;
	return project;
}
