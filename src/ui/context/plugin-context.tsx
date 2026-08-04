import { createContext, useContext } from 'react';
import type { Variable, VariableUsage, SearchScope, SearchProgress } from '../../shared/rpc-types';

export interface PluginState {
	variables: Variable[];
	recentSearches: Variable[];
	searchResults: VariableUsage[];
	searchQuery: string;
	searchVariable: Variable | null;
	isSearching: boolean;
	isSearchCompleted: boolean;
	progress: SearchProgress | null;
	error: string | null;
	cached: boolean;
	scope: SearchScope;
}

export interface PluginActions {
	getAllVariables(): Promise<void>;
	startSearch(variable: Variable, scope?: SearchScope): Promise<void>;
	cancelSearch(): Promise<void>;
	clearSearchResults(): void;
	clearRecentSearches(): void;
	clearCache(variableId?: string): Promise<void>;
	navigateToResult(usage: VariableUsage): Promise<void>;
	setSearchQuery(query: string): void;
	setSearchScope(scope: SearchScope): void;
}

export interface PluginContextValue {
	state: PluginState;
	actions: PluginActions;
}

export const PluginContext = createContext<PluginContextValue | null>(null);

export function usePlugin(): PluginContextValue {
	const ctx = useContext(PluginContext);
	if (!ctx) throw new Error('usePlugin must be used within <PluginProvider>');
	return ctx;
}
