import * as assert from 'assert';

import * as vscode from 'vscode';
import {
	buildCodexErrorMessage,
	findBestMatchingRepositoryRoot,
	isAuthError,
	isTuiError,
	parseCodexJsonl,
	sanitizeBranchNameCandidate,
	selectRepositoryRoot
} from '../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('sanitizeBranchNameCandidate strips wrapper text', () => {
		const raw = 'Branch name: `feat/add-branch-generator`';
		assert.strictEqual(sanitizeBranchNameCandidate(raw), 'feat/add-branch-generator');
	});

	test('sanitizeBranchNameCandidate uses first non-empty line and normalizes', () => {
		const raw = '```\nFix login flow\nwith extra explanation\n```';
		assert.strictEqual(sanitizeBranchNameCandidate(raw), 'fix-login-flow');
	});

	test('sanitizeBranchNameCandidate skips generic placeholder lines', () => {
		const raw = 'branch-name\nfeat/add-real-name';
		assert.strictEqual(sanitizeBranchNameCandidate(raw), 'feat/add-real-name');
	});

	test('findBestMatchingRepositoryRoot prefers the deepest matching repository', () => {
		const repositoryRoots = [
			'/workspace/main-repo',
			'/workspace/main-repo/.worktrees/feature-branch'
		];

		const match = findBestMatchingRepositoryRoot(
			repositoryRoots,
			'/workspace/main-repo/.worktrees/feature-branch/src/extension.ts'
		);

		assert.strictEqual(match, '/workspace/main-repo/.worktrees/feature-branch');
	});

	test('findBestMatchingRepositoryRoot returns undefined when no repository contains the path', () => {
		const match = findBestMatchingRepositoryRoot(
			['/workspace/main-repo', '/workspace/other-repo'],
			'/outside/project/file.ts'
		);

		assert.strictEqual(match, undefined);
	});

	test('selectRepositoryRoot prefers preferredRoot over selected repository', () => {
		const match = selectRepositoryRoot({
			repositories: [
				{ rootPath: '/workspace/main-repo', selected: true },
				{ rootPath: '/workspace/main-repo/.worktrees/feature-branch' }
			],
			preferredPath: '/workspace/main-repo/.worktrees/feature-branch'
		});

		assert.strictEqual(match, '/workspace/main-repo/.worktrees/feature-branch');
	});

	test('selectRepositoryRoot uses hint before selected repository', () => {
		const match = selectRepositoryRoot({
			repositories: [
				{ rootPath: '/workspace/main-repo', selected: true },
				{ rootPath: '/workspace/other-repo' }
			],
			hintedPath: '/workspace/other-repo/src/app.ts'
		});

		assert.strictEqual(match, '/workspace/other-repo');
	});

	test('selectRepositoryRoot uses selected repository when there is exactly one', () => {
		const match = selectRepositoryRoot({
			repositories: [
				{ rootPath: '/workspace/main-repo', selected: true },
				{ rootPath: '/workspace/other-repo' }
			]
		});

		assert.strictEqual(match, '/workspace/main-repo');
	});

	test('selectRepositoryRoot uses active editor before workspace fallback', () => {
		const match = selectRepositoryRoot({
			repositories: [
				{ rootPath: '/workspace/main-repo' },
				{ rootPath: '/workspace/other-repo' }
			],
			activeEditorPath: '/workspace/other-repo/src/feature.ts',
			workspacePaths: ['/workspace/main-repo']
		});

		assert.strictEqual(match, '/workspace/other-repo');
	});

	test('parseCodexJsonl returns the last assistant message', () => {
		const output = [
			'{"type":"message","role":"assistant","content":"first"}',
			'{"type":"item.completed","item":{"type":"agent_message","content":[{"text":"second"}]}}'
		].join('\n');

		assert.strictEqual(parseCodexJsonl(output), 'second');
	});

	test('parseCodexJsonl ignores invalid lines and returns null when no assistant message exists', () => {
		const output = ['not json', '{"type":"message","role":"user","content":"ignored"}'].join('\n');
		assert.strictEqual(parseCodexJsonl(output), null);
	});

	test('isAuthError detects authentication failures', () => {
		assert.strictEqual(isAuthError('Missing credentials: OPENAI_API_KEY'), true);
		assert.strictEqual(isAuthError('network timeout'), false);
	});

	test('isTuiError detects interactive UI failures', () => {
		assert.strictEqual(isTuiError('Raw mode is not supported on this terminal'), true);
		assert.strictEqual(isTuiError('authentication failed'), false);
	});

	test('buildCodexErrorMessage classifies auth errors', () => {
		const message = buildCodexErrorMessage('Missing credentials for CODEX_API_KEY', '', 1);
		assert.match(message, /Authentication failed/);
	});

	test('buildCodexErrorMessage classifies TUI errors', () => {
		const message = buildCodexErrorMessage('Raw mode is not supported', '', 1);
		assert.match(message, /interactive UI/);
	});
});
