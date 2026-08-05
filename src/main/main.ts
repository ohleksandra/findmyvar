import { createRpcServer, FigmaMainTransport } from 'figma-plugin-rpc';
import { registerVariableSearchHandlers } from './handlers/variable-search-handler';
import { getVariablesHandler } from './handlers/get-variables';
import { logger } from '../shared/logger';
import { VariableSearchService } from './services/variableSearchService';
import type { PluginProcedures, PluginNotifications } from '../shared/rpc-types';

export default function () {
	figma.showUI(__html__, { width: 538, height: 800, themeColors: true });

	const rpcServer = createRpcServer<PluginProcedures, PluginNotifications>(
		new FigmaMainTransport(),
	);

	const variableSearchService = new VariableSearchService(rpcServer);
	void variableSearchService.init();

	logger.log('[Plugin] Initialized');

	rpcServer.registerHandler('get-variables', getVariablesHandler);
	registerVariableSearchHandlers(rpcServer, variableSearchService);

	rpcServer.start();
}
