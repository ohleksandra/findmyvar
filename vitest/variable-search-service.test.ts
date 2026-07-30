import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { VariableUsage } from '../src/shared/rpc-types';

const mockNotify = vi.fn();

vi.mock('../src/main/lib/rpc-server', () => ({
	rpcServer: {
		notify: (...args: unknown[]) => mockNotify(...args),
	},
}));

vi.mock('../src/main/lib/logger', () => ({
	logger: {
		log: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	formatDuration: (ms: number) => `${ms}ms`,
}));

function createMockNode(
	id: string,
	name: string,
	type: string = 'FRAME',
	options: {
		boundVariables?: Record<string, unknown>;
		children?: SceneNode[];
		parent?: BaseNode;
	} = {},
): SceneNode {
	const node = {
		id,
		name,
		type,
		boundVariables: options.boundVariables || null,
		children: options.children || [],
		parent: options.parent || null,
	} as unknown as SceneNode;

	if (options.children) {
		for (const child of options.children) {
			(child as unknown as { parent: BaseNode }).parent = node;
		}
	}

	return node;
}

function createMockPage(id: string, name: string, children: SceneNode[] = []): PageNode {
	const page = {
		id,
		name,
		type: 'PAGE',
		children,
		parent: null,
		selection: [],
	} as unknown as PageNode;

	for (const child of children) {
		(child as unknown as { parent: BaseNode }).parent = page;
	}

	return page;
}

describe('VariableSearchService', () => {
	let variableSearchService: typeof import('../src/main/services/variableSearchService').variableSearchService;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.useFakeTimers();

		const module = await import('../src/main/services/variableSearchService');
		variableSearchService = module.variableSearchService;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe('async generator traversal', () => {
		test('traverses deep narrow trees without blocking', async () => {
			let current: SceneNode = createMockNode('leaf', 'Leaf', 'RECTANGLE', {
				boundVariables: { fills: { id: 'var-1' } },
			});

			for (let i = 0; i < 50; i++) {
				current = createMockNode(`frame-${i}`, `Frame ${i}`, 'FRAME', {
					children: [current],
				});
			}

			const page = createMockPage('page-1', 'Page 1', [current]);

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const searchPromise = variableSearchService.search('var-1', 'current-page');

			await vi.runAllTimersAsync();
			await searchPromise;

			const resultCalls = mockNotify.mock.calls.filter(
				(call) => call[0] === 'variableSearch.results',
			);

			expect(resultCalls.length).toBeGreaterThan(0);

			const allResults: VariableUsage[] = [];
			for (const call of resultCalls) {
				const payload = call[1] as { results: VariableUsage[]; isComplete: boolean };
				allResults.push(...payload.results);
			}

			expect(allResults.length).toBe(1);
			expect(allResults[0].nodeId).toBe('leaf');
		});

		test('yields control every 200 nodes', async () => {
			const children: SceneNode[] = [];
			for (let i = 0; i < 500; i++) {
				children.push(
					createMockNode(`node-${i}`, `Node ${i}`, 'RECTANGLE', {
						boundVariables: { fills: { id: 'var-1' } },
					}),
				);
			}

			const page = createMockPage('page-1', 'Page 1', children);

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const searchPromise = variableSearchService.search('var-1', 'current-page');

			await vi.runAllTimersAsync();
			await searchPromise;

			const progressCalls = mockNotify.mock.calls.filter(
				(call) => call[0] === 'variableSearch.progress',
			);

			expect(progressCalls.length).toBeGreaterThan(1);

			const lastProgress = progressCalls[progressCalls.length - 1][1] as {
				nodesProcessed?: number;
			};
			expect(lastProgress.nodesProcessed).toBe(500);
		});
	});

	describe('batch size enforcement', () => {
		test('sends results in batches of exactly 50', async () => {
			const children: SceneNode[] = [];
			for (let i = 0; i < 120; i++) {
				children.push(
					createMockNode(`node-${i}`, `Node ${i}`, 'RECTANGLE', {
						boundVariables: { fills: { id: 'var-1' } },
					}),
				);
			}

			const page = createMockPage('page-1', 'Page 1', children);

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const searchPromise = variableSearchService.search('var-1', 'current-page');

			await vi.runAllTimersAsync();
			await searchPromise;

			const resultCalls = mockNotify.mock.calls.filter(
				(call) => call[0] === 'variableSearch.results',
			);

			const batchSizes: number[] = [];
			for (const call of resultCalls) {
				const payload = call[1] as { results: VariableUsage[]; isComplete: boolean };
				if (!payload.isComplete) {
					batchSizes.push(payload.results.length);
				}
			}

			expect(batchSizes[0]).toBe(50);
			expect(batchSizes[1]).toBe(50);
			expect(batchSizes[2]).toBe(20);
		});
	});

	describe('cache streaming', () => {
		test('streams cached results in batches', async () => {
			const children: SceneNode[] = [];
			for (let i = 0; i < 75; i++) {
				children.push(
					createMockNode(`node-${i}`, `Node ${i}`, 'RECTANGLE', {
						boundVariables: { fills: { id: 'var-1' } },
					}),
				);
			}

			const page = createMockPage('page-1', 'Page 1', children);

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const firstSearch = variableSearchService.search('var-1', 'current-page');
			await vi.runAllTimersAsync();
			await firstSearch;

			mockNotify.mockClear();

			const secondSearch = variableSearchService.search('var-1', 'current-page');
			await vi.runAllTimersAsync();
			await secondSearch;

			const resultCalls = mockNotify.mock.calls.filter(
				(call) => call[0] === 'variableSearch.results',
			);

			expect(resultCalls.length).toBe(2);

			const firstBatch = resultCalls[0][1] as {
				results: VariableUsage[];
				fromCache?: boolean;
			};
			expect(firstBatch.results.length).toBe(50);
			expect(firstBatch.fromCache).toBe(true);

			const secondBatch = resultCalls[1][1] as {
				results: VariableUsage[];
				isComplete: boolean;
				fromCache?: boolean;
			};
			expect(secondBatch.results.length).toBe(25);
			expect(secondBatch.isComplete).toBe(true);
			expect(secondBatch.fromCache).toBe(true);
		});
	});

	describe('LRU cache eviction', () => {
		test('evicts oldest entry when cache exceeds 20 entries', async () => {
			const mockFigma = {
				currentPage: createMockPage('page-1', 'Page 1', []),
				skipInvisibleInstanceChildren: false,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			for (let i = 0; i < 25; i++) {
				const search = variableSearchService.search(`var-${i}`, 'current-page');
				await vi.runAllTimersAsync();
				await search;
			}

			mockNotify.mockClear();

			const firstVarSearch = variableSearchService.search('var-0', 'current-page');
			await vi.runAllTimersAsync();
			await firstVarSearch;

			const resultCalls = mockNotify.mock.calls.filter(
				(call) => call[0] === 'variableSearch.results',
			);

			const fromCache = resultCalls.some(
				(call) => (call[1] as { fromCache?: boolean }).fromCache === true,
			);

			expect(fromCache).toBe(false);
		});
	});

	describe('scope-aware page loading', () => {
		test('does not call loadAllPagesAsync for current-page scope', async () => {
			const loadAllPagesAsync = vi.fn();
			const page = createMockPage('page-1', 'Page 1', []);

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				loadAllPagesAsync,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const search = variableSearchService.search('var-1', 'current-page');
			await vi.runAllTimersAsync();
			await search;

			expect(loadAllPagesAsync).not.toHaveBeenCalled();
		});

		test('does not call loadAllPagesAsync for selection scope', async () => {
			const loadAllPagesAsync = vi.fn();
			const selectedNode = createMockNode('selected', 'Selected', 'FRAME');
			const page = createMockPage('page-1', 'Page 1', [selectedNode]);
			(page as unknown as { selection: SceneNode[] }).selection = [selectedNode];

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				loadAllPagesAsync,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const search = variableSearchService.search('var-1', 'selection');
			await vi.runAllTimersAsync();
			await search;

			expect(loadAllPagesAsync).not.toHaveBeenCalled();
		});

		test('calls loadAllPagesAsync for all-pages scope', async () => {
			const loadAllPagesAsync = vi.fn();
			const page = createMockPage('page-1', 'Page 1', []);

			const mockRoot = {
				children: [page],
			};

			const mockFigma = {
				root: mockRoot,
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				loadAllPagesAsync,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const search = variableSearchService.search('var-1', 'all-pages');
			await vi.runAllTimersAsync();
			await search;

			expect(loadAllPagesAsync).toHaveBeenCalled();
		});
	});

	describe('buildNodePath memoization', () => {
		test('reuses cached paths for sibling nodes', async () => {
			const parentFrame = createMockNode('parent', 'Parent', 'FRAME');
			const grandparent = createMockNode('grandparent', 'Grandparent', 'FRAME', {
				children: [parentFrame],
			});

			const siblings: SceneNode[] = [];
			for (let i = 0; i < 10; i++) {
				siblings.push(
					createMockNode(`sibling-${i}`, `Sibling ${i}`, 'RECTANGLE', {
						boundVariables: { fills: { id: 'var-1' } },
						parent: parentFrame,
					}),
				);
			}

			(parentFrame as unknown as { children: SceneNode[] }).children = siblings;

			const page = createMockPage('page-1', 'Page 1', [grandparent]);

			const mockFigma = {
				currentPage: page,
				skipInvisibleInstanceChildren: false,
				on: vi.fn(),
			};

			vi.stubGlobal('figma', mockFigma);

			const search = variableSearchService.search('var-1', 'current-page');
			await vi.runAllTimersAsync();
			await search;

			const resultCalls = mockNotify.mock.calls.filter(
				(call) => call[0] === 'variableSearch.results',
			);

			const allResults: VariableUsage[] = [];
			for (const call of resultCalls) {
				const payload = call[1] as { results: VariableUsage[] };
				allResults.push(...payload.results);
			}

			expect(allResults.length).toBe(10);

			const paths = allResults.map((r) => r.nodePath);
			const uniquePaths = new Set(paths);
			expect(uniquePaths.size).toBe(1);
			expect(paths[0]).toBe('Grandparent/.../Parent');
		});
	});

	describe('documentchange listener', () => {
		test('init() registers documentchange listener', async () => {
			const on = vi.fn();
			const loadAllPagesAsync = vi.fn().mockResolvedValue(undefined);
			const mockFigma = {
				currentPage: createMockPage('page-1', 'Page 1', []),
				skipInvisibleInstanceChildren: false,
				on,
				loadAllPagesAsync,
			};

			vi.stubGlobal('figma', mockFigma);

			await variableSearchService.init();

			expect(loadAllPagesAsync).toHaveBeenCalled();
			expect(on).toHaveBeenCalledWith('documentchange', expect.any(Function));
		});
	});
});
