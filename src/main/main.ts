import { registerVariableSearchHandlers } from './handlers/variable-search-handler';
// import { findVariableUsageHandler } from './handlers/find-variable-usage';
import { getVariablesHandler } from './handlers/get-variables';
import { rpcServer } from './lib/rpc-server';

export default function () {
	const screenWidth = figma.viewport.bounds.width;
	// const pluginwidth = Math.max(538, Math.floor(screenWidth * 0.4));

	figma.showUI(__html__, { width: 538, height: 800, themeColors: true });

	figma.ui.onmessage = async (message) => {
		rpcServer.registerHandler('get-variables', getVariablesHandler);

		registerVariableSearchHandlers();

		const wasRpc = await rpcServer.processMessage(message);

		if (wasRpc) {
			return;
		} else {
			console.log(message, 'not an RPC message');
		}
	};
}
