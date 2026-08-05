import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SearchCache } from '../src/main/services/search-cache';

function createMockPage(id: string = 'page-1', name: string = 'Page 1'): PageNode {
	return {
		id,
		name,
		type: 'PAGE',
		selection: [],
	} as unknown as PageNode;
}

describe('SearchCache', () => {
	let cache: SearchCache;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

		const mockFigma = {
			currentPage: createMockPage(),
			on: vi.fn(),
		};
		vi.stubGlobal('figma', mockFigma);

		cache = new SearchCache();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe('basic get/set/clear', () => {
		test('returns undefined for missing key', () => {
			expect(cache.get('missing')).toBeUndefined();
		});

		test('stores and retrieves entries', () => {
			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages' as const,
			};
			const key = cache.keyFor('v1', 'all-pages');
			cache.set(key, entry);
			expect(cache.get(key)).toEqual(entry);
		});

		test('clear() removes all entries', () => {
			const key1 = cache.keyFor('v1', 'all-pages');
			const key2 = cache.keyFor('v2', 'all-pages');
			cache.set(key1, {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages',
			});
			cache.set(key2, {
				variableId: 'v2',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages',
			});

			cache.clear();

			expect(cache.get(key1)).toBeUndefined();
			expect(cache.get(key2)).toBeUndefined();
		});

		test('clear(variableId) attempts to delete by key (known limitation)', () => {
			const key1 = cache.keyFor('v1', 'all-pages');
			const key2 = cache.keyFor('v2', 'all-pages');
			cache.set(key1, {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages',
			});
			cache.set(key2, {
				variableId: 'v2',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages',
			});

			cache.clear('v1');

			expect(cache.get(key1)).toBeDefined();
			expect(cache.get(key2)).toBeDefined();
		});
	});

	describe('LRU eviction', () => {
		test('evicts oldest entry when MAX_CACHE_ENTRIES is reached', () => {
			for (let i = 0; i < 21; i++) {
				const key = cache.keyFor(`v${i}`, 'all-pages');
				cache.set(key, {
					variableId: `v${i}`,
					timestamp: Date.now(),
					results: [],
					documentChangeCount: 0,
					scope: 'all-pages',
				});
			}

			expect(cache.get(cache.keyFor('v0', 'all-pages'))).toBeUndefined();
			expect(cache.get(cache.keyFor('v20', 'all-pages'))).toBeDefined();
		});

		test('access promotes entry (LRU, not FIFO)', () => {
			for (let i = 0; i < 20; i++) {
				const key = cache.keyFor(`v${i}`, 'all-pages');
				cache.set(key, {
					variableId: `v${i}`,
					timestamp: Date.now(),
					results: [],
					documentChangeCount: 0,
					scope: 'all-pages',
				});
			}

			cache.get(cache.keyFor('v5', 'all-pages'));

			const newKey = cache.keyFor('v-new', 'all-pages');
			cache.set(newKey, {
				variableId: 'v-new',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages',
			});

			expect(cache.get(cache.keyFor('v0', 'all-pages'))).toBeUndefined();
			expect(cache.get(cache.keyFor('v5', 'all-pages'))).toBeDefined();
		});
	});

	describe('isValid', () => {
		test('returns false for expired entries (TTL > 5 min)', () => {
			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages' as const,
			};

			expect(cache.isValid(entry)).toBe(true);

			vi.advanceTimersByTime(5 * 60 * 1000 + 1);
			expect(cache.isValid(entry)).toBe(false);
		});

		test('returns true within TTL', () => {
			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages' as const,
			};

			vi.advanceTimersByTime(4 * 60 * 1000);
			expect(cache.isValid(entry)).toBe(true);
		});

		test('returns false when documentChangeCount is stale', () => {
			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'all-pages' as const,
			};

			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			mockFigma.on.mock.calls[0][1]({
				documentChanges: [{ type: 'CREATE', id: 'x', node: {} }],
			});
			vi.advanceTimersByTime(600);

			expect(cache.isValid(entry)).toBe(false);
		});

		test('scope=selection: valid when selection key matches', () => {
			const mockFigma = figma as unknown as {
				currentPage: { selection: SceneNode[] };
			};
			mockFigma.currentPage.selection = [
				{ id: 'node-1' } as SceneNode,
				{ id: 'node-2' } as SceneNode,
			];

			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'selection' as const,
				selectionKey: 'node-1,node-2',
			};

			expect(cache.isValid(entry)).toBe(true);
		});

		test('scope=selection: invalid when selection changes', () => {
			const mockFigma = figma as unknown as {
				currentPage: { selection: SceneNode[] };
			};
			mockFigma.currentPage.selection = [{ id: 'node-3' } as SceneNode];

			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'selection' as const,
				selectionKey: 'node-1,node-2',
			};

			expect(cache.isValid(entry)).toBe(false);
		});

		test('scope=current-page: valid when on same page', () => {
			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'current-page' as const,
			};

			expect(cache.isValid(entry)).toBe(true);
		});

		test('scope=current-page: page change does not invalidate (both sides use currentPage)', () => {
			const entry = {
				variableId: 'v1',
				timestamp: Date.now(),
				results: [],
				documentChangeCount: 0,
				scope: 'current-page' as const,
			};

			const mockFigma = figma as unknown as { currentPage: PageNode };
			mockFigma.currentPage = createMockPage('page-2', 'Page 2');

			expect(cache.isValid(entry)).toBe(true);
		});
	});

	describe('keyFor', () => {
		test('all-pages scope key', () => {
			expect(cache.keyFor('v1', 'all-pages')).toBe('v1:all-pages');
		});

		test('current-page scope includes page id', () => {
			expect(cache.keyFor('v1', 'current-page')).toBe('v1:current-page:page-1');
		});

		test('selection scope includes selection key', () => {
			const mockFigma = figma as unknown as {
				currentPage: { selection: SceneNode[] };
			};
			mockFigma.currentPage.selection = [{ id: 'n1' } as SceneNode];
			expect(cache.keyFor('v1', 'selection')).toBe('v1:selection:n1');
		});

		test('empty selection returns "empty" key', () => {
			expect(cache.keyFor('v1', 'selection')).toBe('v1:selection:empty');
		});
	});

	describe('getSelectionKey', () => {
		test('returns "empty" for no selection', () => {
			expect(cache.getSelectionKey()).toBe('empty');
		});

		test('returns sorted comma-separated ids', () => {
			const mockFigma = figma as unknown as {
				currentPage: { selection: SceneNode[] };
			};
			mockFigma.currentPage.selection = [
				{ id: 'c' } as SceneNode,
				{ id: 'a' } as SceneNode,
				{ id: 'b' } as SceneNode,
			];
			expect(cache.getSelectionKey()).toBe('a,b,c');
		});
	});

	describe('document change tracking', () => {
		test('startTracking registers documentchange listener', () => {
			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			expect(mockFigma.on).toHaveBeenCalledWith('documentchange', expect.any(Function));
		});

		test('relevant change increments documentChangeCount after debounce', () => {
			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			const handler = mockFigma.on.mock.calls[0][1];

			handler({
				documentChanges: [{ type: 'CREATE', id: 'x', node: {} }],
			});

			vi.advanceTimersByTime(500);
			expect(cache.getDocumentChangeCount()).toBe(1);
		});

		test('irrelevant change does not increment count', () => {
			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			const handler = mockFigma.on.mock.calls[0][1];

			handler({
				documentChanges: [
					{ type: 'PROPERTY_CHANGE', id: 'x', node: {}, properties: ['name'] },
				],
			});

			vi.advanceTimersByTime(500);
			expect(cache.getDocumentChangeCount()).toBe(0);
		});

		test('PROPERTY_CHANGE on boundVariables is relevant', () => {
			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			const handler = mockFigma.on.mock.calls[0][1];

			handler({
				documentChanges: [
					{
						type: 'PROPERTY_CHANGE',
						id: 'x',
						node: {},
						properties: ['boundVariables'],
					},
				],
			});

			vi.advanceTimersByTime(500);
			expect(cache.getDocumentChangeCount()).toBe(1);
		});

		test('multiple rapid changes debounce to a single count increment', () => {
			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			const handler = mockFigma.on.mock.calls[0][1];

			handler({
				documentChanges: [{ type: 'CREATE', id: 'x', node: {} }],
			});
			vi.advanceTimersByTime(100);
			handler({
				documentChanges: [{ type: 'DELETE', id: 'y' }],
			});
			vi.advanceTimersByTime(100);
			handler({
				documentChanges: [{ type: 'CREATE', id: 'z', node: {} }],
			});

			vi.advanceTimersByTime(500);
			expect(cache.getDocumentChangeCount()).toBe(1);
		});

		test('DELETE change is relevant', () => {
			cache.startTracking();
			const mockFigma = figma as unknown as { on: ReturnType<typeof vi.fn> };
			const handler = mockFigma.on.mock.calls[0][1];

			handler({
				documentChanges: [{ type: 'DELETE', id: 'x' }],
			});

			vi.advanceTimersByTime(500);
			expect(cache.getDocumentChangeCount()).toBe(1);
		});
	});
});
