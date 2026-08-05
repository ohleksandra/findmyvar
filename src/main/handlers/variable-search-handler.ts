import type { RpcServer } from 'figma-plugin-rpc';
import type { PluginProcedures, PluginNotifications } from '../../shared/rpc-types';
import { VariableSearchService } from '../services/variableSearchService';

export function registerVariableSearchHandlers(
	rpcServer: RpcServer<PluginProcedures, PluginNotifications>,
	variableSearchService: VariableSearchService,
): void {
	rpcServer.registerHandler('variableSearch.start', (payload) => {
		void variableSearchService.search(payload.variableId, payload.scope, payload.searchId);
		return { started: true };
	});

	rpcServer.registerHandler('variableSearch.cancel', async () => {
		variableSearchService.cancelSearch();
		return { cancelled: true };
	});

	rpcServer.registerHandler('variableSearch.clearCache', (payload) => {
		variableSearchService.clearCache(payload && payload.variableId);
		return { cleared: true };
	});

	rpcServer.registerHandler('variableSearch.navigateTo', async (payload) => {
		const { nodeId, pageId } = payload;
		const page = (await figma.getNodeByIdAsync(pageId)) as PageNode | null;
		const node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode | null;

		if (!page || !node) {
			return { success: false, error: 'Node not found' };
		}

		await figma.setCurrentPageAsync(page);
		figma.viewport.scrollAndZoomIntoView([node]);
		figma.currentPage.selection = [node];

		return { success: true };
	});
}
