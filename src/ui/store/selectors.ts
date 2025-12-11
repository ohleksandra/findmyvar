import type { Variable, VariableUsage } from '../../shared/rpc-types';
import { usePluginStore } from './plugin-store-old';

export function useVariables(): Variable[] {
	return usePluginStore((state) => state.variables);
}

export function useUsages(): VariableUsage[] {
	return usePluginStore((state) => state.usages);
}

export function useIsLoading(): boolean {
	return usePluginStore(
		(state) => state.isLoadingCollections || state.isLoadingVariables || state.isLoadingUsages,
	);
}
