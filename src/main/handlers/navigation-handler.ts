import type { PluginProcedures } from '../../shared/rpc-types';
import type { HandlerMap } from './types';

type NavigateToPayload = PluginProcedures['variableSearch.navigateTo']['request'];

export function navigationHandlers(): HandlerMap {
	return {
		'variableSearch.navigateTo': async (payload: NavigateToPayload) => {
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
		},
	};
}
