import { createRpcServer, FigmaMainTransport } from 'figma-plugin-rpc';
import { registerAllHandlers } from './handlers';
import { logger } from '../shared/logger';
import { VariableSearchService } from './services/variableSearchService';
import { UnusedVariableScanner } from './services/unused-variable-scanner';
import type { PluginProcedures, PluginNotifications } from '../shared/rpc-types';

export default function () {
	figma.showUI(__html__, { width: 538, height: 800, themeColors: true });

	const rpcServer = createRpcServer<PluginProcedures, PluginNotifications>(
		new FigmaMainTransport(),
	);

	const variableSearchService = new VariableSearchService(rpcServer);
	void variableSearchService.init();

	const unusedVariableScanner = new UnusedVariableScanner(rpcServer);

	logger.log('[Plugin] Initialized');

	registerAllHandlers(rpcServer, { variableSearchService, unusedVariableScanner });
	rpcServer.start();
}
