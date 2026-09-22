import {
	type Connection,
	check,
	type DiagramItem,
	type Project,
	validateProject,
} from '../model/project.js';

export interface Artifact {
	path: string;
	content: string;
}

function lines(text: string): string[] {
	return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
}

function body(text: string): string[] {
	return lines(text).map((line) => `  ${line}`);
}
function relationships(
	item: DiagramItem,
	items: Map<string, DiagramItem>,
	edges: Connection[],
): string[] {
	const output: string[] = [];
	for (const edge of edges) {
		const to = items.get(edge.to);
		const label = edge.label;
		check(to, 'Relationship references a missing note');
		check(
			typeof label === 'string' &&
				label.trim() &&
				!label.includes('\n') &&
				!label.includes('\r'),
			'Give every arrow a one-line relationship before generating the Tale',
		);
		output.push(`  ${item.title} ${label.trim()} ${to.title}.`);
	}
	return output;
}

export function compile(project: Project): Artifact[] {
	validateProject(project);
	check(
		!project.name.includes('\n') && !project.name.includes('\r'),
		'Project name must be one line',
	);
	const output = [`TALE ${project.name}`];
	if (project.description.trim())
		output.push('', 'ABOUT', ...body(project.description));
	const definitions = new Map(
		project.definitions.map((definition) => [definition.id, definition]),
	);
	const items = new Map(project.diagram.items.map((item) => [item.id, item]));
	const edges = new Map<string, Connection[]>();
	for (const edge of project.diagram.connections) {
		const outgoing = edges.get(edge.from) ?? [];
		outgoing.push(edge);
		edges.set(edge.from, outgoing);
	}
	for (const item of project.diagram.items) {
		const definition = definitions.get(item.definitionId);
		check(definition, 'Missing Tag or Skill definition');
		check(
			!definition.name.includes('\n') && !definition.name.includes('\r'),
			'Tag or Skill name must be one line',
		);
		check(
			!item.title.includes('\n') && !item.title.includes('\r'),
			'Item title must be one line',
		);
		const heading =
			definition.kind === 'skill'
				? `SKILL ${definition.name}`
				: item.title === definition.name
					? definition.tag
					: `${definition.tag} ${item.title}`;
		output.push('', heading);
		if (item.text) output.push(...body(item.text));
		output.push(...relationships(item, items, edges.get(item.id) ?? []));
	}
	return [{ path: '.tale/project.tale', content: `${output.join('\n')}\n` }];
}
