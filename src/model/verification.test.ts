import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateReply } from './bridge.js';
import {
	validateVerificationPreview,
	validateVerificationResult,
} from './verification.js';

test('verification IPC validates evidence and approval fields', () => {
	validateVerificationPreview({
		token: 't',
		target: '/project',
		baselinePath: '/trusted/approval',
		digest: 'digest',
		previousDigest: null,
		approved: false,
		contract: 'contract',
		commands: [],
		files: [],
	});
	const evidence = {
		passed: false,
		digest: 'digest',
		checks: [{ id: 'check', passed: false, message: 'Missing output' }],
		requirements: [],
	};
	validateVerificationResult(evidence);
	validateReply({ ok: true, evidence });
	assert.throws(() =>
		validateReply({ ok: true, evidence: { ...evidence, passed: 'yes' } }),
	);
	assert.throws(() =>
		validateVerificationResult({
			...evidence,
			checks: [{ id: 'check', passed: true }],
		}),
	);
	assert.throws(() => validateVerificationPreview({ approved: true }));
});
