import { SearchScope } from '../../shared/rpc-types';
import { SCOPE_ALL_PAGES, SCOPE_CURRENT_PAGE, SCOPE_SELECTION } from '../../shared/constants';

interface SearchTarget {
	page: PageNode;
	topLevelNodes: SceneNode[];
}

async function resolveSearchTargets(scope: SearchScope): Promise<SearchTarget[]> {
	switch (scope) {
		case SCOPE_ALL_PAGES:
			await figma.loadAllPagesAsync();
			return figma.root.children.map((page) => ({
				page,
				topLevelNodes: page.children as SceneNode[],
			}));

		case SCOPE_CURRENT_PAGE:
			return [
				{
					page: figma.currentPage,
					topLevelNodes: figma.currentPage.children as SceneNode[],
				},
			];

		case SCOPE_SELECTION: {
			const selection = figma.currentPage.selection;
			if (selection.length === 0) {
				return [];
			}

			return [
				{
					page: figma.currentPage,
					topLevelNodes: selection as SceneNode[],
				},
			];
		}

		default:
			return [];
	}
}

export { resolveSearchTargets, type SearchTarget };
