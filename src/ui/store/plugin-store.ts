import type { SearchScope, Variable, VariableUsage } from '../../shared/rpc-types';
import { DEFAULT_SCOPE } from '../../shared/constants';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { callPlugin } from '@/lib/call-plugin';
import type { SearchProgress } from '../../shared/rpc-types';
import { nanoid } from 'nanoid';

const safeStorage: Storage = (() => {
	try {
		const ls = localStorage;
		const k = '__findmyvar_ls_test__';
		ls.setItem(k, '1');
		ls.removeItem(k);
		return ls;
	} catch {
		return {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {},
			clear: () => {},
			key: () => null,
			length: 0,
		} as Storage;
	}
})();

interface PluginStore {
	variables: Variable[];
	recentSearches: Variable[];
	error: string | null;
	progress: SearchProgress | null;
	isSearching: boolean;
	searchVariable: Variable | null;
	cached: boolean;
	searchResults: VariableUsage[];
	searchQuery: string;
	isSearchCompleted: boolean;
	isSearchCancelled: boolean;
	scope: SearchScope;
	activeSearchId: string | null;

	getAllVariables(): Promise<void>;
	clearRecentSearches(): void;
	startSearch(variable: Variable, scope?: SearchScope): Promise<void>;
	cancelSearch(): Promise<void>;
	clearSearchResults(): void;
	resetSearch(): Promise<void>;
	clearCache(variableId?: string): Promise<void>;
	navigateToResult(usage: VariableUsage): Promise<void>;
	setSearchQuery(query: string): void;
	setSearchScope: (scope: SearchScope) => void;

	// Helpers for internal use
	_appendResults(
		searchId: string,
		results: VariableUsage[],
		isComplete: boolean,
		fromCache?: boolean,
	): void;
	_setProgress(searchId: string, progress: SearchProgress): void;
	_setError(searchId: string, error: string): void;
}

export const usePluginStore = create<PluginStore>()(
	persist(
		(set, get) => ({
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
			isSearchCancelled: false,
			scope: DEFAULT_SCOPE,
			activeSearchId: null,

			async getAllVariables() {
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

			startSearch: async (variable: Variable, scope?: SearchScope) => {
				const currentScope = scope ?? get().scope;
				const searchId = nanoid();

				set({
					isSearching: true,
					isSearchCompleted: false,
					isSearchCancelled: false,
					searchVariable: variable,
					scope: currentScope,
					error: null,
					progress: null,
					cached: false,
					activeSearchId: searchId,
				});

				get().clearSearchResults();

				try {
					await callPlugin('variableSearch.start', {
						variableId: variable.id,
						scope: currentScope,
						searchId,
					});
				} catch (err) {
					set({
						isSearching: false,
						error: err instanceof Error ? err.message : 'Search failed',
						activeSearchId: null,
					});
				}
			},

			cancelSearch: async () => {
				const searchId = get().activeSearchId;
				try {
					await callPlugin('variableSearch.cancel');
				} catch {
					// Stop anyway: the UI stops listening to the search, so its results can't show up.
				}
				// The search may have finished while cancelling. Then it stays finished.
				if (!searchId || get().activeSearchId !== searchId) return;
				// Not completed: results so far are partial, so an empty list doesn't mean unused.
				set({ isSearching: false, isSearchCancelled: true, activeSearchId: null });
			},

			clearSearchResults: () => {
				set({
					searchResults: [],
					error: null,
					progress: null,
				});
			},

			resetSearch: async () => {
				if (get().isSearching) {
					await get().cancelSearch();
				}
				// Back to the start screen: no query, no variable, no "no results" state.
				set({
					searchQuery: '',
					searchVariable: null,
					searchResults: [],
					isSearchCompleted: false,
					isSearchCancelled: false,
					error: null,
					progress: null,
					cached: false,
				});
			},

			clearCache: async (variableId?: string) => {
				await callPlugin('variableSearch.clearCache', { variableId });
			},

			setSearchScope: (scope: SearchScope) => {
				const state = get();

				set({ scope });

				if (state.searchVariable && !state.isSearching) {
					get().startSearch(state.searchVariable, scope);
				}
			},

			navigateToResult: async (usage: VariableUsage) => {
				await callPlugin('variableSearch.navigateTo', {
					nodeId: usage.nodeId,
					pageId: usage.pageId,
				});
			},

			_appendResults: (
				searchId: string,
				results: VariableUsage[],
				isComplete: boolean,
				fromCache = false,
			) => {
				const state = get();

				if (state.activeSearchId !== searchId) {
					return;
				}

				if (results.length > 0) {
					set({ searchResults: state.searchResults.concat(results) });
				}

				if (isComplete) {
					const searchVariable = state.searchVariable;
					if (searchVariable) {
						set((prev) => {
							const recent = prev.recentSearches.filter(
								(v) => v.id !== searchVariable.id,
							);
							recent.unshift(searchVariable);
							if (recent.length > 3) {
								recent.length = 3;
							}
							return { recentSearches: recent };
						});
					}
					set({
						isSearching: false,
						isSearchCompleted: true,
						cached: fromCache,
						activeSearchId: null,
					});
				}
			},

			setSearchQuery: (query: string) => {
				set({ searchQuery: query });
			},

			_setProgress: (searchId: string, progress: SearchProgress) => {
				const state = get();
				if (state.activeSearchId !== searchId) {
					return;
				}
				set({ progress });
			},

			_setError: (searchId: string, error: string) => {
				const state = get();
				if (state.activeSearchId !== searchId) {
					return;
				}
				set({ isSearching: false, error, activeSearchId: null });
			},
		}),
		{
			name: 'findmyvar-store',
			storage: createJSONStorage(() => safeStorage),
			partialize: (state) => ({
				recentSearches: state.recentSearches,
				scope: state.scope,
			}),
		},
	),
);
