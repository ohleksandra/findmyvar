import type { UnusedVariable } from '../../../shared/rpc-types';
import type { UnusedGroup, UnusedNode } from './unused-tree-model';

export function flattenNodes(nodes: UnusedNode[]): UnusedNode[] {
	return nodes.flatMap((n) => [
		// No parent is shown in a flat list.
		{ ...n, children: [], parentId: null },
		...flattenNodes(n.children),
	]);
}

/** A shared variable appears once per parent in the tree, but only once in a flat list. */
export function uniqueNodes(nodes: UnusedNode[]): UnusedNode[] {
	const seen = new Set<string>();
	return nodes.filter((n) => !seen.has(n.variable.id) && !!seen.add(n.variable.id));
}

/** `filter` is trimmed and lowercased. A variable matches by its name or its collection's name. */
export function matchesFilter(variable: UnusedVariable, filter: string): boolean {
	return (
		variable.name.toLowerCase().includes(filter) ||
		variable.collectionName.toLowerCase().includes(filter)
	);
}

export interface FilteredGroup {
	/** What to show: the group's tree, or a flat list of matching variables. */
	nodes: UnusedNode[];
	/** The variables shown, for counting and "Select". */
	ids: string[];
}

/**
 * A group whose collection matches the filter shows as usual. Otherwise its matching variables show
 * as a flat list, so nothing is hidden inside a tree.
 */
export function filterGroup(group: UnusedGroup, filter: string): FilteredGroup {
	if (!filter || group.name.toLowerCase().includes(filter)) {
		return { nodes: group.roots, ids: group.ids };
	}
	const nodes = uniqueNodes(flattenNodes(group.roots)).filter((n) =>
		matchesFilter(n.variable, filter),
	);
	return { nodes, ids: nodes.map((n) => n.variable.id) };
}
