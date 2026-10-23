import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { acquireTraversalMode, resetTraversalMode } from '../src/main/services/traversal-mode';

describe('traversal mode', () => {
	let mockFigma: { skipInvisibleInstanceChildren: boolean };

	beforeEach(() => {
		resetTraversalMode();
		mockFigma = { skipInvisibleInstanceChildren: false };
		vi.stubGlobal('figma', mockFigma);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('a search skips hidden layers and restores the original value', () => {
		const release = acquireTraversalMode('fast');
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);
		release();
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);
	});

	test('a search finishing during a scan does not make the scan skip hidden layers', () => {
		const releaseScan = acquireTraversalMode('full');
		const releaseSearch = acquireTraversalMode('fast');
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);

		releaseSearch();
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);

		releaseScan();
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);
	});

	test('a scan starting during a search includes hidden layers, then the search resumes', () => {
		mockFigma.skipInvisibleInstanceChildren = true;
		const releaseSearch = acquireTraversalMode('fast');
		const releaseScan = acquireTraversalMode('full');
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);

		releaseScan();
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);

		releaseSearch();
		// Back to what the user had before either started.
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);
	});

	test('releasing twice does not unbalance the count', () => {
		const releaseScan = acquireTraversalMode('full');
		const releaseOther = acquireTraversalMode('full');
		releaseOther();
		releaseOther();
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);
		releaseScan();
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(false);
	});
});
