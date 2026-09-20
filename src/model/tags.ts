import type { Json } from './project.js';

export function validTag(tag: string): boolean {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	return (
		letters.includes(tag[0] ?? '') &&
		tag.length > 0 &&
		[...tag].every((c) => `${letters}0123456789_`.includes(c))
	);
}

export function unusedTagColor(used: string[]): string {
	const rgb = {
		start: 0x475569,
		step: 0x112233,
		max: 0x1000000,
		hex: 16,
		width: 6,
	};
	const occupied = new Set(used.map((color) => color.toUpperCase()));
	let value = rgb.start;
	let color: string;
	do {
		color = `#${value.toString(rgb.hex).padStart(rgb.width, '0').toUpperCase()}`;
		value = (value + rgb.step) % rgb.max;
	} while (occupied.has(color));
	return color;
}

// Directive order is part of the output format, independent of JSON key order.
export const directives: Record<string, string[]> = {
	REQUIREMENT: [
		'id',
		'action',
		'subject',
		'condition',
		'expected',
		'mandatory',
		'verified_by',
	],
	CHECK: [
		'id',
		'action',
		'executable',
		'arguments',
		'protected_files',
		'timeout_ms',
	],
	META: [
		'ID',
		'TYPE',
		'TITLE',
		'LANGUAGE',
		'RUNTIME',
		'FRAMEWORK',
		'DATABASE',
		'IAC',
		'TEST_FRAMEWORK',
		'HTTP_TEST_TOOL',
	],
	PRODUCT: [
		'platforms',
		'editor',
		'items',
		'connections',
		'project_format',
		'tags',
		'tag_coverage',
		'rule_types',
		'environments',
		'output',
		'agent_entrypoints',
	],
	ARCHITECTURE: [
		'separate',
		'svg_library',
		'editor_dependencies',
		'ui',
		'application_dependencies',
		'filesystem',
		'ipc',
		'ipc_validation',
		'context_isolation',
		'node_integration',
		'renderer_sandbox',
		'project_content',
	],
	EDITOR: [
		'layout',
		'viewport',
		'app_scroll',
		'canvas_navigation',
		'zoom_input',
		'zoom_anchor',
		'chrome',
		'copy',
		'oversized_headings',
		'item_titles',
		'item_text',
		'dragging',
		'draggable',
		'connections',
		'tag_colors',
		'tag_labels',
		'toolbar',
		'toolbar_labels',
		'menu',
		'property_controls',
		'raw_json_editing',
	],
	DEPLOYMENT: [
		'mode',
		'project_json',
		'target',
		'output',
		'agents',
		'agent_file',
		'agent_update',
		'preview',
		'existing_tale',
		'unrelated_files',
		'repeat',
	],
	DEPENDENCIES: ['default', 'allow', 'development_allow', 'changes'],
	AGREEMENT: [
		'before_implementation',
		'unclear_requirements',
		'scope_expansion',
		'existing_approval',
		'contract_changes',
		'structured_conflicts',
		'approval_baseline',
	],
	CHANGES: [
		'default',
		'refactor',
		'rename',
		'delete',
		'unrelated_changes',
		'preserve_user_changes',
		'restore_deleted_code',
	],
	QUALITY: ['typescript_strict', 'lint', 'format', 'weaken_checks'],
	TESTING: [
		'assertions',
		'bugfix',
		'changed_behavior',
		'editor_changes',
		'editor_cases',
		'ui_cases',
		'ipc_changes',
		'editor_e2e',
		'deploy_e2e',
		'weaken_expectations',
		'test_files',
		'test_pattern',
		'test_scope',
		'test_pair_check',
	],
	DETERMINISM: [
		'mode',
		'target',
		'comparison',
		'encoding',
		'line_endings',
		'final_newline',
		'canonicalize',
		'rerun_check',
		'clean_build_check',
	],
	AGENTIC_TESTS: [
		'pattern',
		'allow_create',
		'allow_modify',
		'freeze_after',
		'freeze_mode',
	],
};
export const tags = [
	'TALE',
	'META',
	'GOAL',
	'REQUIREMENT',
	'CHECK',
	'PRODUCT',
	'ARCHITECTURE',
	'EDITOR',
	'DEPLOYMENT',
	'DEPENDENCIES',
	'AGREEMENT',
	'CHANGES',
	'SCOPE',
	'QUALITY',
	'TESTING',
	'DETERMINISM',
	'AGENTIC_TESTS',
	'PLAN',
	'PROOF',
	'OVERRIDES',
];
export function defaults(tag: string): Record<string, Json> {
	switch (tag) {
		case 'REQUIREMENT':
			return {
				action: '',
				subject: '',
				condition: 'exists',
				expected: '',
				mandatory: true,
			};
		case 'CHECK':
			return {
				action: '',
				executable: '',
				arguments: [],
				protected_files: [],
				timeout_ms: 30000,
			};
		case 'TALE':
			return { version: 'v0' };
		case 'META':
			return { ID: 'new.tale', TYPE: 'project' };
		case 'GOAL':
			return { text: 'Describe the intended outcome.' };
		case 'SCOPE':
			return { mode: 'allow', paths: [] };
		case 'PLAN':
		case 'PROOF':
		case 'OVERRIDES':
			return { steps: [] };
		case 'DETERMINISM':
			return { mode: 'strict', rerun_check: { runs: 2 } };
		default:
			return {};
	}
}
