import type { RpcHandler } from 'figma-plugin-rpc';
import type { PluginProcedures } from '../../shared/rpc-types';
import type { VariableSearchService } from '../services/variableSearchService';

export type HandlerMap = {
	[K in keyof PluginProcedures & string]?: RpcHandler<PluginProcedures, K>;
};

export interface HandlerDeps {
	variableSearchService: VariableSearchService;
}
