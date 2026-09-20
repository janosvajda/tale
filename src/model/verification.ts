import { check, record } from './project.js';

export interface VerificationResult {
	passed: boolean;
	digest: string;
	checks: { id: string; passed: boolean; message: string }[];
	requirements: { id: string; passed: boolean; message: string }[];
}
export interface VerificationPreview {
	token: string;
	target: string;
	baselinePath: string;
	digest: string;
	previousDigest: string | null;
	approved: boolean;
	contract: string;
	commands: string[];
	files: string[];
}
export function validateVerificationPreview(
	value: unknown,
): asserts value is VerificationPreview {
	check(
		record(value) &&
			['token', 'target', 'baselinePath', 'digest', 'contract'].every(
				(key) => typeof value[key] === 'string',
			) &&
			typeof value.approved === 'boolean' &&
			(value.previousDigest === null ||
				typeof value.previousDigest === 'string'),
		'Invalid verification preview',
	);
	for (const key of ['commands', 'files'])
		check(
			Array.isArray(value[key]) &&
				value[key].every((entry: unknown) => typeof entry === 'string'),
			'Invalid verification preview entries',
		);
}
export function validateVerificationResult(
	value: unknown,
): asserts value is VerificationResult {
	check(
		record(value) &&
			typeof value.passed === 'boolean' &&
			typeof value.digest === 'string',
		'Invalid verification result',
	);
	for (const key of ['checks', 'requirements'])
		check(
			Array.isArray(value[key]) &&
				value[key].every(
					(entry: unknown) =>
						record(entry) &&
						typeof entry.id === 'string' &&
						typeof entry.passed === 'boolean' &&
						typeof entry.message === 'string',
				),
			'Invalid evidence',
		);
}
