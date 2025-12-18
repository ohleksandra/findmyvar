// handlers/variable-search-handlers.ts

import { rpcServer } from '../rpc/rpc-server';
import { VariableSearchService } from '../services/variable-search-service';

// Create service instance with rpcServer.notify bound
const searchService = new VariableSearchService(rpcServer.notify.bind(rpcServer));

export function registerVariableSearchHandlers(): void {
	rpcServer
		.registerHandler('variableSearch.start', async ({ variableId, scope }) => {
			const started = await searchService.startSearch(variableId, scope);
			return { started };
		})
		.registerHandler('variableSearch.cancel', async () => {
			const cancelled = searchService.cancelSearch();
			return { cancelled };
		})
		.registerHandler('variableSearch.clearCache', async () => {
			// Placeholder for future caching
			return { cleared: true };
		})
		.registerHandler('variableSearch.navigateTo', async ({ nodeId, pageId }) => {
			try {
				const page = await figma.getNodeByIdAsync(pageId);
				if (!page || page.type !== 'PAGE') {
					return { success: false, error: 'Page not found' };
				}

				if (figma.currentPage.id !== pageId) {
					await figma.setCurrentPageAsync(page as PageNode);
				}

				const node = await figma.getNodeByIdAsync(nodeId);
				if (!node || !('type' in node)) {
					return { success: false, error: 'Node not found' };
				}

				figma.currentPage.selection = [node as SceneNode];
				figma.viewport.scrollAndZoomIntoView([node as SceneNode]);

				return { success: true };
			} catch (err) {
				return {
					success: false,
					error: err instanceof Error ? err.message : 'Navigation failed',
				};
			}
		});
}
