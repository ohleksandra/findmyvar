import type { Variable, VariableUsage } from '../../shared/rpc-types';
import { devtools } from 'zustand/middleware';
import { create } from 'zustand';
import { callPlugin } from '@/lib/rpc-client';

interface VariablesState {
	collections: { id: string; name: string }[];
	variables: Variable[];
	selectedCollectionId: string | null;
	selectedVariableId: string | null;
}

interface UsagesState {
	usages: VariableUsage[];
	searchedVariableId: string | null;
}

interface UIState {
	isLoadingCollections: boolean;
	isLoadingVariables: boolean;
	isLoadingUsages: boolean;
	error: string | null;
}

interface VariablesActions {
	fetchCollections: () => Promise<void>;
	fetchVariables: (collectionId?: string) => Promise<void>;
	selectCollection: (collectionId: string | null) => void;
	selectVariable: (variableId: string | null) => void;
}

interface UsagesActions {
	findUsages: (variableId: string) => Promise<void>;
	clearUsages: () => void;
}

interface UIActions {
	clearError: () => void;
}

interface SearchState {
	searchedVariableName: string | null;
	recentSearches: string[];
}

interface SearchActions {
	searchByName: (variableName: string) => Promise<boolean>;
	addRecentSearch: (variableName: string) => void;
	clearSearch: () => void;
}

type PluginStore = VariablesState &
	UsagesState &
	UIState &
	VariablesActions &
	UsagesActions &
	UIActions &
	SearchState &
	SearchActions;

export const usePluginStore = create<PluginStore>()(
	devtools(
		(set, get) => ({
			variables: [],
			collections: [],
			selectedCollectionId: null,
			selectedVariableId: null,
			usages: [],
			searchedVariableId: null,
			isLoadingCollections: false,
			isLoadingVariables: false,
			isLoadingUsages: false,
			error: null,
			searchedVariableName: null,
			recentSearches: [],

			fetchVariables: async () => {
				set({ isLoadingVariables: true, error: null });

				try {
					const { variables } = await callPlugin('get-variables');

					set({
						variables,
						isLoadingVariables: false,
					});
				} catch (err) {
					set({
						isLoadingVariables: false,
						error: err instanceof Error ? err.message : 'Failed to fetch variables',
					});
				}
			},

			selectVariable: (variableId) => {
				set({ selectedVariableId: variableId });
			},

			clearError: () => {
				set({ error: null });
			},
		}),
		{ name: 'PluginStore' },
	),
);
