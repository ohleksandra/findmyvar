// src/ui/hooks/useVariableSearch.ts

import { useEffect } from 'react';
import { useVariableSearchStore, initVariableSearchListeners } from '@/store/variable-search-store';

let listenersInitialized = false;
let cleanupListeners: (() => void) | null = null;

export function useVariableSearch(variableId?: string) {
	const store = useVariableSearchStore();

	// Initialize listeners once
	useEffect(() => {
		if (!listenersInitialized) {
			cleanupListeners = initVariableSearchListeners();
			listenersInitialized = true;
		}

		return () => {
			// Cleanup on unmount if needed
			// cleanupListeners?.();
			// listenersInitialized = false;
		};
	}, []);

	// Auto-search when variableId changes
	useEffect(() => {
		if (variableId && variableId !== store.searchVariableId) {
			store.startSearch(variableId);
		}
	}, [variableId]);

	// Cancel on unmount
	useEffect(() => {
		return () => {
			if (store.isSearching) {
				store.cancelSearch();
			}
		};
	}, []);

	return {
		results: store.results,
		isSearching: store.isSearching,
		progress: store.progress,
		error: store.error,
		wasCached: store.wasCached,
		search: store.startSearch,
		cancel: store.cancelSearch,
		clear: store.clearResults,
		refresh: async () => {
			if (store.searchVariableId) {
				await store.clearCache(store.searchVariableId);
				await store.startSearch(store.searchVariableId);
			}
		},
		navigateTo: store.navigateToResult,
	};
}
