import { nanoid } from 'nanoid';
import { rpcServer } from '../lib/rpc-server';
import { variableSearchService } from '../services/variableSearchService';

export function registerVariableSearchHandlers(): void {
	rpcServer.registerHandler('variableSearch.start', (payload) => {
		const searchId = nanoid();
		void variableSearchService.search(payload.variableId, payload.scope, searchId);
		return { started: true, searchId };
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
