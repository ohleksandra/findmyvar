import { SearchScope } from '../../shared/rpc-types';

export class ScopeResolver {
	validate(scope: SearchScope): { valid: boolean; error?: string } {
		switch (scope) {
			case 'all-pages':
				return figma.root.children.length > 0
					? { valid: true }
					: { valid: false, error: 'No pages in document' };

			case 'current-page':
				return figma.currentPage
					? { valid: true }
					: { valid: false, error: 'No active page' };

			case 'selection':
				return figma.currentPage.selection.length > 0
					? { valid: true }
					: { valid: false, error: 'No nodes selected' };

			default:
				return { valid: false, error: `Unknown scope: ${scope}` };
		}
	}

	resolve(scope: SearchScope): {
		pages: PageNode[];
		rootNodes: SceneNode[];
		isSelectionScope: boolean;
		selectionPageContext: { id: string; name: string } | null;
	} {
		switch (scope) {
			case 'all-pages':
				return {
					pages: [...figma.root.children] as PageNode[],
					rootNodes: [],
					isSelectionScope: false,
					selectionPageContext: null,
				};

			case 'current-page':
				return {
					pages: [figma.currentPage],
					rootNodes: [],
					isSelectionScope: false,
					selectionPageContext: null,
				};

			case 'selection':
				return {
					pages: [],
					rootNodes: [...figma.currentPage.selection],
					isSelectionScope: true,
					selectionPageContext: {
						id: figma.currentPage.id,
						name: figma.currentPage.name,
					},
				};
		}
	}
}
