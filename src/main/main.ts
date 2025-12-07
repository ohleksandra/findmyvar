import { rpcServer } from './lib/rpc-server';

export default function () {
	const screenWidth = figma.viewport.bounds.width;
	const pluginwidth = Math.max(900, Math.floor(screenWidth * 0.4));

	figma.showUI(__html__, { width: pluginwidth, height: 600, themeColors: true });

	figma.ui.onmessage = async (message) => {
		const wasRpc = await rpcServer.processMessage(message);

		if (wasRpc) {
			return;
		} else {
			console.log(message, 'not an RPC message');
		}
	};
}
