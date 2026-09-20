import { type ItemSection, id, type Json } from './project.js';
import { directives } from './tags.js';

const labels: Record<string, string> = {
	contract_verify: 'Verify approved contract',
	request_change: 'Request a requirement change',
	requirement: 'Requirement ID',
	reason: 'Reason for change',
	action: 'Action being checked',
	subject: 'File to inspect',
	condition: 'Required behavior',
	expected: 'Approved reference file',
	mandatory: 'Required for completion',
	executable: 'Program to run',
	arguments: 'Arguments',
	protected_files: 'Tests and adapters to protect',
	timeout_ms: 'Timeout (milliseconds)',
	exists: 'File must exist',
	absent: 'File must not exist',
	equals_file: 'Match the approved reference exactly',
	unchanged: 'File must remain unchanged',
	command_succeeds: 'Linked command must succeed',
	platforms: 'Supported platforms',
	items: 'Diagram shapes',
	connections: 'Allowed connections',
	editor: 'Editor style',
	text: 'Description',
	paths: 'Files and folders',
	mode: 'Policy',
	development_allow: 'Allowed development tools',
	separate: 'Separate components',
	steps: 'Steps',
	expect: 'Expected result',
	exit: 'Exit code',
	runs: 'Number of runs',
	TYPE: 'Tale type',
	ID: 'Identifier',
	LANGUAGE: 'Programming language',
	TEST_FRAMEWORK: 'Test framework',
	command: 'Command',
	when: 'When',
	operation: 'Action',
	require_approval: 'Needs approval',
	allow_create: 'Allow creating tests',
	miro_style: 'Freeform board',
	allow: 'Allowed',
	deny: 'Forbidden',
	rectangle: 'Rectangle',
	arrow: 'Arrow',
	branches: 'Branching paths',
	loops: 'Loops',
	multiple: 'Multiple connections',
	code_changed: 'When code changes',
	after_agreed_checks: 'After agreed checks pass',
	paired_sibling: 'One test file beside each source file',
	application_typescript: 'All application TypeScript files',
	npm_run_lint: 'Checked by npm run lint',
	semantic_typed: 'Controls suited to each rule',
};
export function readable(value: string): string {
	const label = labels[value];
	if (label) return label;
	if (!value.includes('_')) return value;
	const words = value.toLowerCase().split('_').join(' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}
export function fieldLabel(key: string): string {
	const label = readable(key);
	return label.charAt(0).toUpperCase() + label.slice(1);
}
const choices: Record<string, string[]> = {
	'REQUIREMENT.condition': [
		'exists',
		'absent',
		'equals_file',
		'unchanged',
		'command_succeeds',
	],
	'PRODUCT.platforms': ['macOS', 'Windows', 'Linux'],
	'PRODUCT.items': ['rectangle', 'arrow'],
	'PRODUCT.connections': ['branches', 'loops', 'multiple'],
	'PRODUCT.editor': ['miro_style'],
	'META.TYPE': ['project', 'task'],
	'SCOPE.mode': ['allow', 'require_approval', 'deny'],
	'DETERMINISM.mode': ['strict', 'normalized'],
	'EDITOR.zoom_input': ['touchpad', 'mouse'],
	'EDITOR.menu': ['open_json', 'save', 'save_as', 'deploy'],
	'step.operation': [
		'run',
		'review',
		'stop',
		'contract_verify',
		'request_change',
	],
	'step.checks': ['scope', 'unrelated_behavior', 'added_lines'],
	'ARCHITECTURE.separate': [
		'visual_editor',
		'svg_library',
		'electron_ui',
		'application',
		'preload',
	],
	'ARCHITECTURE.editor_dependencies': ['svg_library', 'project_model'],
	'step.when': ['code_changed', 'after_agreed_checks'],
};
const policies = ['allow', 'require_approval', 'deny'];
export function fieldChoices(tag: string, key: string, value: Json): string[] {
	const configured = choices[`${tag}.${key}`];
	if (configured) return configured;
	if (typeof value === 'string' && policies.includes(value)) return policies;
	const initial = initialValues[`${tag}.${key}`];
	if (typeof initial === 'string' && initial) return [initial];
	return [];
}
export function stepTemplate(operation: string): Record<string, Json> {
	if (operation === 'contract_verify')
		return {
			operation,
			attributes: { baseline: 'external', coverage: 'mandatory' },
		};
	if (operation === 'request_change')
		return { operation, attributes: { requirement: '', reason: '' } };
	if (operation === 'run')
		return {
			operation,
			command: '',
			expect: { exit: 0 },
			when: 'code_changed',
		};
	if (operation === 'review') return { operation, checks: [] };
	if (operation === 'stop') return { operation, when: 'after_agreed_checks' };
	return { operation, args: [], attributes: {}, children: [] };
}
const literalFields = new Set([
	'subject',
	'expected',
	'executable',
	'arguments',
	'protected_files',
	'command',
	'paths',
	'args',
	'output',
	'pattern',
	'test_pattern',
	'ID',
	'text',
]);
export function summary(value: Json, key = ''): string {
	if (value === null) return 'Not set';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (Array.isArray(value))
		return value.map((child) => summary(child, key)).join(', ') || 'None';
	if (typeof value === 'object')
		return Object.entries(value)
			.map(([key, child]) => `${fieldLabel(key)}: ${summary(child, key)}`)
			.join(' · ');
	return typeof value === 'string' && !literalFields.has(key)
		? readable(value)
		: String(value);
}
export function itemSummary(properties: Record<string, Json>): string[] {
	return Object.entries(properties).flatMap(([key, value]) => {
		if (key === 'text' && typeof value === 'string') return value.split('\n');
		if (key === 'steps' && Array.isArray(value))
			return value.map((child) => summary(child));
		return [`${fieldLabel(key)}: ${summary(value, key)}`];
	});
}

const initialValues: Record<string, Json> = {
	'REQUIREMENT.action': '',
	'REQUIREMENT.subject': '',
	'REQUIREMENT.condition': 'exists',
	'REQUIREMENT.expected': '',
	'REQUIREMENT.mandatory': true,
	'CHECK.action': '',
	'CHECK.executable': '',
	'CHECK.arguments': [],
	'CHECK.protected_files': [],
	'CHECK.timeout_ms': 30000,
	'AGREEMENT.contract_changes': 'require_approval',
	'AGREEMENT.structured_conflicts': 'block',
	'AGREEMENT.approval_baseline': 'external',
	'META.ID': '',
	'META.TYPE': 'project',
	'META.LANGUAGE': '',
	'META.RUNTIME': '',
	'META.TEST_FRAMEWORK': '',
	'PRODUCT.platforms': [],
	'PRODUCT.editor': 'miro_style',
	'PRODUCT.items': [],
	'PRODUCT.connections': [],
	'PRODUCT.project_format': 'JSON',
	'PRODUCT.tags': 'diagram_items',
	'PRODUCT.rule_types': 'user_defined',
	'PRODUCT.environments': 'user_defined',
	'PRODUCT.output': '',
	'PRODUCT.agent_entrypoints': 'official',
	'PRODUCT.tag_coverage': 'all_defined',
	'ARCHITECTURE.separate': [],
	'ARCHITECTURE.svg_library': 'first_party_reusable',
	'ARCHITECTURE.editor_dependencies': [],
	'ARCHITECTURE.ui': 'native_html_css_browser_apis',
	'ARCHITECTURE.application_dependencies': 'no_ui_or_svg',
	'ARCHITECTURE.filesystem': 'electron_main',
	'ARCHITECTURE.ipc': 'typed_allowlisted_preload_api',
	'ARCHITECTURE.ipc_validation': 'sender_payload_result',
	'ARCHITECTURE.context_isolation': true,
	'ARCHITECTURE.node_integration': false,
	'ARCHITECTURE.renderer_sandbox': true,
	'ARCHITECTURE.project_content': 'inert_data',
	'DEPENDENCIES.default': 'deny',
	'DEPENDENCIES.allow': [],
	'DEPENDENCIES.development_allow': [],
	'DEPENDENCIES.changes': 'require_approval',
	'AGREEMENT.before_implementation': 'agree_goal_scope_checks',
	'AGREEMENT.unclear_requirements': 'ask_user',
	'AGREEMENT.scope_expansion': 'require_approval',
	'AGREEMENT.existing_approval': 'reuse',
	'CHANGES.default': 'minimal',
	'CHANGES.refactor': 'require_approval',
	'CHANGES.rename': 'require_approval',
	'CHANGES.delete': 'require_approval',
	'CHANGES.unrelated_changes': 'deny',
	'CHANGES.preserve_user_changes': true,
	'CHANGES.restore_deleted_code': 'require_approval',
	'QUALITY.typescript_strict': true,
	'QUALITY.lint': 'biome',
	'QUALITY.format': 'biome',
	'QUALITY.weaken_checks': 'deny',
	'TESTING.assertions': 'observable_behavior',
	'TESTING.bugfix': 'regression_test',
	'TESTING.changed_behavior': 'require_coverage',
	'TESTING.editor_changes': 'interaction_check',
	'TESTING.weaken_expectations': 'deny',
	'TESTING.editor_cases': [],
	'TESTING.ipc_changes': 'boundary_tests',
	'TESTING.editor_e2e': 'json_to_tale_determinism',
	'TESTING.ui_cases': [],
	'TESTING.deploy_e2e': 'compiled_tales_agent_entrypoint',
	'TESTING.test_files': 'paired_sibling',
	'TESTING.test_pattern': '',
	'TESTING.test_scope': 'application_typescript',
	'TESTING.test_pair_check': 'npm_run_lint',
	'AGENTIC_TESTS.pattern': '',
	'AGENTIC_TESTS.allow_create': true,
	'AGENTIC_TESTS.allow_modify': 'within_task',
	'AGENTIC_TESTS.freeze_after': 'proof_pass',
	'EDITOR.layout': 'board_first',
	'EDITOR.viewport': 'fit_app_window',
	'EDITOR.app_scroll': 'deny',
	'EDITOR.canvas_navigation': 'pan_zoom',
	'EDITOR.zoom_input': [],
	'EDITOR.zoom_anchor': 'pointer',
	'EDITOR.chrome': 'compact',
	'EDITOR.copy': 'concise',
	'EDITOR.oversized_headings': 'deny',
	'EDITOR.item_titles': 'required_editable',
	'EDITOR.item_text': 'editable',
	'EDITOR.dragging': 'pointer_accurate',
	'EDITOR.draggable': 'all_diagram_objects',
	'EDITOR.connections': 'anchored_precise',
	'EDITOR.tag_colors': 'distinct_stable',
	'EDITOR.tag_labels': 'visible',
	'EDITOR.toolbar': 'all_diagram_items',
	'EDITOR.toolbar_labels': 'visible',
	'EDITOR.menu': [],
	'EDITOR.property_controls': 'semantic_typed',
	'EDITOR.raw_json_editing': 'deny',
	'DETERMINISM.mode': 'strict',
	'DETERMINISM.target': 'compiled_tales',
	'DETERMINISM.comparison': 'byte_exact',
	'DETERMINISM.encoding': 'utf8',
	'DETERMINISM.line_endings': 'lf',
	'DETERMINISM.final_newline': true,
	'DETERMINISM.rerun_check': {
		runs: 2,
	},
	'DETERMINISM.clean_build_check': {
		runs: 2,
	},
	'DEPLOYMENT.mode': 'compiled_tales',
	'DEPLOYMENT.project_json': 'save_save_as_only',
	'DEPLOYMENT.target': 'selected_project',
	'DEPLOYMENT.output': '',
	'DEPLOYMENT.agents': 'user_selected',
	'DEPLOYMENT.agent_file': 'selected_official_entrypoint',
	'DEPLOYMENT.agent_update': 'preserve_content_upsert_reference',
	'DEPLOYMENT.preview': 'required',
	'DEPLOYMENT.existing_tale': 'confirm_overwrite',
	'DEPLOYMENT.unrelated_files': 'preserve',
	'DEPLOYMENT.repeat': 'idempotent',
};

export function availableFields(tag: string): string[] {
	if (tag === 'TALE') return ['version'];
	if (tag === 'GOAL') return ['text'];
	if (tag === 'SCOPE') return ['mode', 'paths'];
	if (['PLAN', 'PROOF', 'OVERRIDES'].includes(tag)) return ['steps'];
	return (directives[tag] ?? []).filter(
		(key) => !['id', 'verified_by'].includes(key),
	);
}
export function initialValue(tag: string, key: string): Json {
	if (key === 'steps' || key === 'paths' || key === 'canonicalize') return [];
	if (key === 'version') return 'v0';
	if (key === 'mode' && tag === 'SCOPE') return 'allow';
	return structuredClone(initialValues[`${tag}.${key}`] ?? '');
}

export function newSection(type: ItemSection['type']): ItemSection {
	const base = { id: id(), title: sectionTypeLabel(type) };
	return type === 'text'
		? { ...base, type, text: '' }
		: {
				...base,
				type,
				options: [
					{ id: id(), label: 'Option 1', selected: false },
					{ id: id(), label: 'Option 2', selected: false },
				],
			};
}
export function sectionTypeLabel(type: ItemSection['type']): string {
	return {
		text: 'Free text',
		checkboxes: 'Checkboxes',
		radio: 'Radio buttons',
	}[type];
}
export function duplicateSection(section: ItemSection): ItemSection {
	const copy = structuredClone(section);
	copy.id = id();
	if (copy.type !== 'text')
		copy.options = copy.options.map((option) => ({ ...option, id: id() }));
	return copy;
}
export function sectionSummary(section: ItemSection): string {
	return section.type === 'text'
		? section.text
		: section.options
				.filter((option) => option.selected)
				.map((option) => option.label)
				.join(', ');
}
