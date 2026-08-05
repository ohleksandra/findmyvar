import { createRpcServer, FigmaMainTransport } from 'figma-plugin-rpc';
import { registerAllHandlers } from './handlers';
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

	registerAllHandlers(rpcServer, { variableSearchService });
	rpcServer.start();
}
