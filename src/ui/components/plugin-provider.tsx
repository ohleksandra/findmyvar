import { useEffect, useMemo } from 'react';
import { usePluginStore } from '@/store/plugin-store';
import { useShallow } from 'zustand/react/shallow';
import { rpcClient } from '@/lib/call-plugin';
import { PluginContext, type PluginContextValue } from '@/context/plugin-context';

export function PluginProvider({ children }: { children: React.ReactNode }) {
	const state = usePluginStore(
		useShallow((s) => ({
			variables: s.variables,
			recentSearches: s.recentSearches,
			searchResults: s.searchResults,
			searchQuery: s.searchQuery,
			searchVariable: s.searchVariable,
			isSearching: s.isSearching,
			isSearchCompleted: s.isSearchCompleted,
			progress: s.progress,
			error: s.error,
			cached: s.cached,
			scope: s.scope,
		})),
	);

	const actions = usePluginStore(
		useShallow((s) => ({
			getAllVariables: s.getAllVariables,
			startSearch: s.startSearch,
			cancelSearch: s.cancelSearch,
			clearSearchResults: s.clearSearchResults,
			clearRecentSearches: s.clearRecentSearches,
			clearCache: s.clearCache,
			navigateToResult: s.navigateToResult,
			setSearchQuery: s.setSearchQuery,
			setSearchScope: s.setSearchScope,
		})),
	);

	useEffect(() => {
		const unsubResults = rpcClient.on('variableSearch.results', (p) => {
			usePluginStore
				.getState()
				._appendResults(p.searchId, p.results, p.isComplete, p.fromCache);
		});
		const unsubProgress = rpcClient.on('variableSearch.progress', (p) => {
			usePluginStore.getState()._setProgress(p.searchId, p);
		});
		const unsubError = rpcClient.on('variableSearch.error', (p) => {
			usePluginStore.getState()._setError(p.searchId, p.error);
		});
		return () => {
			unsubResults();
			unsubProgress();
			unsubError();
		};
	}, []);

	const value: PluginContextValue = useMemo(() => ({ state, actions }), [state, actions]);

	return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}
