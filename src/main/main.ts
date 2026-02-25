import { registerVariableSearchHandlers } from './handlers/variable-search-handler';
import { getVariablesHandler } from './handlers/get-variables';
import { logger } from './lib/logger';
import { rpcServer } from './lib/rpc-server';

export default function () {
	figma.showUI(__html__, { width: 538, height: 800, themeColors: true });

	logger.log('[Plugin] Initialized');

	rpcServer.registerHandler('get-variables', getVariablesHandler);
	registerVariableSearchHandlers();

	figma.ui.onmessage = async (message) => {
		const wasRpc = await rpcServer.processMessage(message);
		if (wasRpc) return;
	};
}
