import type { UnusedVariable } from '../../../shared/rpc-types';
import { buildChildrenMap, descendantsOf } from '../../../shared/unused-tree';

export interface UnusedNode {
	variable: UnusedVariable;
	children: UnusedNode[];
	/** The variable this copy is nested under, or null at the top level and in flat lists. */
	parentId: string | null;
}

export interface UnusedGroup {
	name: string;
	isPalette: boolean;
	roots: UnusedNode[];
	ids: string[];
}

interface TreeLinks {
	byId: Map<string, UnusedVariable>;
	/** For each variable, the nested variables that point to it. */
	children: Map<string, string[]>;
}

/**
 * A variable that points to several unused variables (say one per mode) sits under each of them.
 * Like the scanner's `parentId`, a palette value never holds a non-palette one, and variables
 * without a `parentId` (including where the scanner broke a cycle) stay at the top level.
 */
function buildLinks(unused: UnusedVariable[]): TreeLinks {
	const byId = new Map(unused.map((v) => [v.id, v]));
	const children = new Map<string, string[]>();
	for (const parent of unused) {
		for (const { id } of parent.usedBy) {
			const child = byId.get(id);
			if (!child?.parentId || !byId.has(child.parentId)) continue;
			if (parent.isPalette && !child.isPalette) continue;
			children.set(parent.id, [...(children.get(parent.id) ?? []), child.id]);
		}
	}
	return { byId, children };
}

function toNode(
	variable: UnusedVariable,
	links: TreeLinks,
	parentId: string | null,
	ancestors: Set<string>,
): UnusedNode {
	const path = new Set(ancestors).add(variable.id);
	return {
		variable,
		children: (links.children.get(variable.id) ?? [])
			// Skips anything already on the way down, so a loop between modes can't recurse forever.
			.filter((id) => !path.has(id))
			.map((id) => links.byId.get(id))
			.filter((v): v is UnusedVariable => v !== undefined)
			.map((child) => toNode(child, links, variable.id, path)),
		parentId,
	};
}

function flatten(node: UnusedNode): string[] {
	return [node.variable.id, ...node.children.flatMap(flatten)];
}

/** Groups unused variables by the collection of their top-level variable, palettes last. */
export function buildGroups(unused: UnusedVariable[]): UnusedGroup[] {
	const links = buildLinks(unused);
	const { byId } = links;
	const groups = new Map<string, UnusedGroup>();

	for (const variable of unused) {
		if (variable.parentId && byId.has(variable.parentId)) continue;
		const key = `${variable.isPalette ? 1 : 0}:${variable.collectionName}`;
		const group = groups.get(key) ?? {
			name: variable.collectionName,
			isPalette: variable.isPalette,
			roots: [],
			ids: [],
		};
		const node = toNode(variable, links, null, new Set());
		group.roots.push(node);
		// A shared variable can show up more than once in a group, but it's still one variable.
		group.ids = Array.from(new Set([...group.ids, ...flatten(node)]));
		groups.set(key, group);
	}

	return Array.from(groups.values()).sort((a, b) => Number(a.isPalette) - Number(b.isPalette));
}

/**
 * For every selected variable's dependents, the name of the selected variable they get deleted
 * with. Those rows are shown ticked and locked.
 */
export function buildLockMap(unused: UnusedVariable[], selectedIds: string[]): Map<string, string> {
	const byId = new Map(unused.map((v) => [v.id, v]));
	const dependents = buildChildrenMap(unused);
	const locks = new Map<string, string>();
	for (const id of selectedIds) {
		const name = byId.get(id)?.name;
		if (!name) continue;
		for (const dependent of descendantsOf(id, dependents)) {
			if (!locks.has(dependent)) locks.set(dependent, name);
		}
	}
	return locks;
}

/** "Used only by button-bg and card-bg" / "Used only by button-bg and 4 more". */
export function usedOnlyByLabel(usedBy: { name: string }[]): string {
	const names = usedBy.map((u) => u.name);
	if (names.length === 1) return `Used only by ${names[0]}`;
	if (names.length === 2) return `Used only by ${names[0]} and ${names[1]}`;
	return `Used only by ${names[0]} and ${names.length - 1} more`;
}
