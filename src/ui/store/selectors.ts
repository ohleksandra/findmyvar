import type { Variable } from '../../shared/rpc-types';
import { usePluginStore } from './plugin-store';

export function useVariables(): Variable[] {
	return usePluginStore((state) => state.variables);
}

export function useIsLoading(): boolean {
	return usePluginStore(
		(state) => state.isLoadingCollections || state.isLoadingVariables || state.isLoadingUsages,
	);
}
