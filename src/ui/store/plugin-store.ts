import type { SearchScope, Variable, VariableUsage } from '../../shared/rpc-types';
import { create } from 'zustand';
import { callPlugin, rpcClient } from '@/lib/rpc-client';
import type { SearchProgress } from '../../shared/rpc-types';

interface PluginStore {
	variables: Variable[];
	recentSearches: Map<string, Variable>;
	error: string | null;
	progress: SearchProgress | null;
	isSearching: boolean;
	searchVariable: Variable | null;
	cached: boolean;
	searchResults: VariableUsage[];
	searchQuery: string;
	isSearchCompleted: boolean;
	scope: SearchScope;

	fetchVariables(): Promise<void>;
	clearRecentSearches(): void;
	startSearch(variable: Variable): Promise<void>;
	cancelSearch(): Promise<void>;
	clearSearchResults(): void;
	clearCache(variableId?: string): Promise<void>;
	navigateToResult(usage: VariableUsage): Promise<void>;
	setSearchQuery(query: string): void;
	setScope: (scope: SearchScope) => void;

	// Helpers for internal use
	_appendResults(results: VariableUsage[], isComplete: boolean): void;
	_setProgress(progress: SearchProgress): void;
	_setError(error: string): void;
}

export const usePluginStore = create<PluginStore>()((set, get) => ({
	variables: [],
	recentSearches: new Map<string, Variable>(),
	error: null,
	progress: null,
	isSearching: false,
	searchVariable: null,
	cached: false,
	searchResults: [],
	searchQuery: '',
	isSearchCompleted: false,
	scope: 'all-pages',

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
		set({ recentSearches: new Map<string, Variable>() });
	},

	startSearch: async (variable: Variable, scope: SearchScope) => {
		const currentScope = scope ?? get().scope;

		set({
			isSearching: true,
			searchVariable: variable,
			scope: currentScope,
			error: null,
			progress: null,
			cached: false,
		});

		get().clearSearchResults();

		try {
			await callPlugin('variableSearch.start', {
				variableId: variable.id,
				scope: currentScope,
			});
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
			// searchVariable: null,
		});
	},

	clearCache: async (variableId?: string) => {
		await callPlugin('variableSearch.clearCache', { variableId });
	},

	setScope: (scope: SearchScope) => {
		set({ scope });
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
			const searchVariable = state.searchVariable;
			if (searchVariable) {
				set((prev) => {
					const recent = new Map(prev.recentSearches);
					if (!recent.has(searchVariable.id)) {
						recent.set(searchVariable.id, searchVariable);
					}
					return { recentSearches: recent };
				});
			}
			set({
				isSearching: false,
				isSearchCompleted: true,
				cached,
			});
		}
	},

	setSearchQuery: (query: string) => {
		set({ searchQuery: query });
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
