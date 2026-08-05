import type { RpcServer } from 'figma-plugin-rpc';
import type { PluginProcedures, PluginNotifications } from '../../shared/rpc-types';
import { getVariablesHandlers } from './get-variables';
import { variableSearchHandlers } from './variable-search-handler';
import { navigationHandlers } from './navigation-handler';
import type { HandlerDeps } from './types';

export function registerAllHandlers(
	rpcServer: RpcServer<PluginProcedures, PluginNotifications>,
	deps: HandlerDeps,
): void {
	const modules = [getVariablesHandlers(), variableSearchHandlers(deps), navigationHandlers()];

	for (const mod of modules) {
		for (const key of Object.keys(mod) as (keyof PluginProcedures & string)[]) {
			const handler = mod[key];
			if (handler) {
				rpcServer.registerHandler(key, handler);
			}
		}
	}
}
