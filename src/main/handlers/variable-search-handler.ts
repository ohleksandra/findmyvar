import type { PluginProcedures } from '../../shared/rpc-types';
import type { HandlerMap, HandlerDeps } from './types';

export function variableSearchHandlers(deps: HandlerDeps): HandlerMap {
	const { variableSearchService } = deps;

	type StartPayload = PluginProcedures['variableSearch.start']['request'];
	type ClearCachePayload = PluginProcedures['variableSearch.clearCache']['request'];

	return {
		'variableSearch.start': (payload: StartPayload) => {
			void variableSearchService.search(payload.variableId, payload.scope, payload.searchId);
			return { started: true };
		},

		'variableSearch.cancel': async () => {
			variableSearchService.cancelSearch();
			return { cancelled: true };
		},

		'variableSearch.clearCache': (payload: ClearCachePayload) => {
			variableSearchService.clearCache(payload && payload.variableId);
			return { cleared: true };
		},
	};
}
