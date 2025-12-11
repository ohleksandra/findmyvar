import type { Variable, VariableUsage } from '../../shared/rpc-types';
import { create } from 'zustand';
import { callPlugin, rpcClient } from '@/lib/rpc-client';
import type { SearchProgress } from '../../shared/rpc-types';

interface PluginStore {
	variables: Variable[];
	recentSearches: string[];
	error: string | null;
	progress: SearchProgress | null;
	isSearching: boolean;
	searchVariableId: string | null;
	cached: boolean;
	searchResults: VariableUsage[];

	fetchVariables(): Promise<void>;
	clearRecentSearches(): void;
	startSearch(variableId: string): Promise<void>;
	cancelSearch(): Promise<void>;
	clearSearchResults(): void;
	clearCache(variableId?: string): Promise<void>;
	navigateToResult(usage: VariableUsage): Promise<void>;

	// Helpers for internal use
	_appendResults(results: VariableUsage[], isComplete: boolean): void;
	_setProgress(progress: SearchProgress): void;
	_setError(error: string): void;
}

export const usePluginStore = create<PluginStore>()((set, get) => ({
	variables: [],
	recentSearches: [],
	error: null,
	progress: null,
	isSearching: false,
	searchVariableId: null,
	cached: false,
	searchResults: [],

	async fetchVariables() {
		try {
			const { variables } = await callPlugin('get-variables');

			set({ variables });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : 'Failed to fetch variables',
			});
		}
	},

	clearRecentSearches: () => {
		set({ recentSearches: [] });
	},

	startSearch: async (variableId: string) => {
		set({
			isSearching: true,
			searchVariableId: variableId,
			error: null,
			progress: null,
			cached: false,
		});

		try {
			await callPlugin('variableSearch.start', { variableId });
		} catch (err) {
			set({
				isSearching: false,
				error: err instanceof Error ? err.message : 'Search failed',
			});
		}
	},

	cancelSearch: async () => {
		try {
			await callPlugin('variableSearch.cancel', undefined as void);
		} finally {
			set({ isSearching: false });
		}
	},

	clearSearchResults: () => {
		set({
			searchResults: [],
			error: null,
			progress: null,
			searchVariableId: null,
		});
	},

	clearCache: async (variableId?: string) => {
		await callPlugin('variableSearch.clearCache', { variableId });
	},

	navigateToResult: async (usage: VariableUsage) => {
		await callPlugin('variableSearch.navigateTo', {
			nodeId: usage.nodeId,
			pageId: usage.pageId,
		});
	},

	_appendResults: (results: VariableUsage[], isComplete: boolean) => {
		const state = get();

		if (results.length > 0) {
			set({ searchResults: [...state.searchResults, ...results] });
		}

		if (isComplete) {
			const cached = state.progress?.currentPage === 'Cached';
			set({
				isSearching: false,
				cached,
				recentSearches: [...state.recentSearches, state.searchVariableId!],
			});
		}
	},

	_setProgress: (progress: SearchProgress) => {
		set({ progress });
	},

	_setError: (error: string) => {
		set({ isSearching: false, error });
	},
}));

export function initSearchListeners(): () => void {
	const state = usePluginStore.getState();

	const unsubResults = rpcClient.on('variableSearch.results', (payload) => {
		state._appendResults(payload.results, payload.isComplete);
	});

	const unsubProgress = rpcClient.on('variableSearch.progress', (payload) => {
		state._setProgress(payload);
	});

	const unsubError = rpcClient.on('variableSearch.error', (payload) => {
		state._setError(payload.error);
	});

	return () => {
		unsubResults();
		unsubProgress();
		unsubError();
	};
}
