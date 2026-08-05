import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mockCallPlugin = vi.fn();

vi.mock('../src/ui/lib/call-plugin', () => ({
	callPlugin: (...args: unknown[]) => mockCallPlugin(...args),
	rpcClient: {
		on: vi.fn(() => vi.fn()),
	},
}));

vi.mock('../src/shared/logger', () => ({
	logger: {
		log: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	formatDuration: (ms: number) => `${ms}ms`,
}));

describe('PluginStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const resetStore = async () => {
		const { usePluginStore } = await import('../src/ui/store/plugin-store');
		usePluginStore.setState({
			variables: [],
			recentSearches: [],
			error: null,
			progress: null,
			isSearching: false,
			searchVariable: null,
			cached: false,
			searchResults: [],
			searchQuery: '',
			isSearchCompleted: false,
			scope: 'all-pages',
			activeSearchId: null,
		});
		return usePluginStore;
	};

	describe('_appendResults', () => {
		test('appends results to searchResults', async () => {
			const usePluginStore = await resetStore();
			const searchId = 'search-1';
			usePluginStore.setState({ activeSearchId: searchId });

			usePluginStore.getState()._appendResults(
				searchId,
				[
					{
						nodeId: 'node-1',
						nodeName: 'Node 1',
						nodeType: 'RECTANGLE',
						field: 'fills',
						pageName: 'Page 1',
						pageId: 'page-1',
						nodePath: '',
					},
				],
				false,
			);

			expect(usePluginStore.getState().searchResults).toHaveLength(1);
		});

		test('sets isSearching to false on completion', async () => {
			const usePluginStore = await resetStore();
			const searchId = 'search-1';
			usePluginStore.setState({ isSearching: true, activeSearchId: searchId });

			usePluginStore.getState()._appendResults(searchId, [], true);

			expect(usePluginStore.getState().isSearching).toBe(false);
			expect(usePluginStore.getState().isSearchCompleted).toBe(true);
		});

		test('adds variable to recentSearches on completion', async () => {
			const usePluginStore = await resetStore();
			const searchId = 'search-1';
			const variable = {
				id: 'var-1',
				name: 'Test Variable',
				resolvedType: 'COLOR' as const,
				hiddenFromPublishing: false,
			};

			usePluginStore.setState({
				searchVariable: variable,
				isSearching: true,
				activeSearchId: searchId,
			});

			usePluginStore.getState()._appendResults(searchId, [], true);

			expect(usePluginStore.getState().recentSearches).toHaveLength(1);
			expect(usePluginStore.getState().recentSearches[0].id).toBe('var-1');
		});

		test('deduplicates recentSearches', async () => {
			const usePluginStore = await resetStore();
			const searchId = 'search-1';
			const variable = {
				id: 'var-1',
				name: 'Test Variable',
				resolvedType: 'COLOR' as const,
				hiddenFromPublishing: false,
			};

			usePluginStore.setState({
				recentSearches: [variable],
				searchVariable: variable,
				isSearching: true,
				activeSearchId: searchId,
			});

			usePluginStore.getState()._appendResults(searchId, [], true);

			expect(usePluginStore.getState().recentSearches).toHaveLength(1);
		});

		test('caps recentSearches at 3', async () => {
			const usePluginStore = await resetStore();
			const variables = [
				{
					id: 'var-1',
					name: 'Var 1',
					resolvedType: 'COLOR' as const,
					hiddenFromPublishing: false,
				},
				{
					id: 'var-2',
					name: 'Var 2',
					resolvedType: 'COLOR' as const,
					hiddenFromPublishing: false,
				},
				{
					id: 'var-3',
					name: 'Var 3',
					resolvedType: 'COLOR' as const,
					hiddenFromPublishing: false,
				},
			];

			usePluginStore.setState({ recentSearches: variables });

			const searchId = 'search-4';
			const newVariable = {
				id: 'var-4',
				name: 'Var 4',
				resolvedType: 'COLOR' as const,
				hiddenFromPublishing: false,
			};

			usePluginStore.setState({
				searchVariable: newVariable,
				isSearching: true,
				activeSearchId: searchId,
			});

			usePluginStore.getState()._appendResults(searchId, [], true);

			expect(usePluginStore.getState().recentSearches).toHaveLength(3);
			expect(usePluginStore.getState().recentSearches[0].id).toBe('var-4');
		});

		test('ignores results with mismatched searchId', async () => {
			const usePluginStore = await resetStore();
			usePluginStore.setState({ activeSearchId: 'search-1' });

			usePluginStore.getState()._appendResults(
				'search-2',
				[
					{
						nodeId: 'node-1',
						nodeName: 'Node 1',
						nodeType: 'RECTANGLE',
						field: 'fills',
						pageName: 'Page 1',
						pageId: 'page-1',
						nodePath: '',
					},
				],
				false,
			);

			expect(usePluginStore.getState().searchResults).toHaveLength(0);
		});
	});

	describe('cancelSearch', () => {
		test('clears activeSearchId', async () => {
			const usePluginStore = await resetStore();
			usePluginStore.setState({ activeSearchId: 'search-1', isSearching: true });

			mockCallPlugin.mockResolvedValue({ cancelled: true });

			await usePluginStore.getState().cancelSearch();

			expect(usePluginStore.getState().activeSearchId).toBeNull();
			expect(usePluginStore.getState().isSearching).toBe(false);
		});

		test('prevents stale notifications from updating state', async () => {
			const usePluginStore = await resetStore();
			const searchId = 'search-1';
			usePluginStore.setState({ activeSearchId: searchId, isSearching: true });

			mockCallPlugin.mockResolvedValue({ cancelled: true });

			await usePluginStore.getState().cancelSearch();

			usePluginStore.getState()._appendResults(searchId, [], true);

			expect(usePluginStore.getState().isSearchCompleted).toBe(true);
			expect(usePluginStore.getState().recentSearches).toHaveLength(0);
		});
	});

	describe('setSearchScope', () => {
		test('updates scope', async () => {
			const usePluginStore = await resetStore();
			usePluginStore.getState().setSearchScope('current-page');
			expect(usePluginStore.getState().scope).toBe('current-page');
		});

		test('does not re-search if already searching', async () => {
			const usePluginStore = await resetStore();
			mockCallPlugin.mockResolvedValue({ started: true });

			usePluginStore.setState({ isSearching: true, searchVariable: null });

			usePluginStore.getState().setSearchScope('current-page');

			expect(mockCallPlugin).not.toHaveBeenCalledWith(
				'variableSearch.start',
				expect.anything(),
			);
		});
	});
});
