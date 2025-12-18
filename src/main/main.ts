// import { findVariableUsageHandler } from './handlers/find-variable-usage';
import { getVariablesHandler } from './handlers/get-variables';
import { registerVariableSearchHandlers } from './handlers/variable-search-handler';
import { rpcServer } from './rpc/rpc-server';

export default function () {
	figma.showUI(__html__, { width: 538, height: 800, themeColors: true });

	rpcServer.registerHandler('get-variables', getVariablesHandler);
	registerVariableSearchHandlers();

	figma.ui.onmessage = async (message) => {
		const wasRpc = await rpcServer.processMessage(message);
		if (wasRpc) return;
	};
}
