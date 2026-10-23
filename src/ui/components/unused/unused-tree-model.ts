import type { UnusedVariable } from '../../../shared/rpc-types';
import { buildChildrenMap, descendantsOf } from '../../../shared/unused-tree';

export interface UnusedNode {
	variable: UnusedVariable;
	children: UnusedNode[];
}

export interface UnusedGroup {
	name: string;
	isPalette: boolean;
	roots: UnusedNode[];
	ids: string[];
}

function toNode(
	variable: UnusedVariable,
	byId: Map<string, UnusedVariable>,
	children: Map<string, string[]>,
): UnusedNode {
	return {
		variable,
		children: (children.get(variable.id) ?? [])
			.map((id) => byId.get(id))
			.filter((v): v is UnusedVariable => v !== undefined)
			.map((child) => toNode(child, byId, children)),
	};
}

function flatten(node: UnusedNode): string[] {
	return [node.variable.id, ...node.children.flatMap(flatten)];
}

/** Groups unused variables by the collection of their top-level variable, palettes last. */
export function buildGroups(unused: UnusedVariable[]): UnusedGroup[] {
	const byId = new Map(unused.map((v) => [v.id, v]));
	const children = new Map<string, string[]>();
	for (const variable of unused) {
		if (!variable.parentId) continue;
		children.set(variable.parentId, [...(children.get(variable.parentId) ?? []), variable.id]);
	}
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
		const node = toNode(variable, byId, children);
		group.roots.push(node);
		group.ids.push(...flatten(node));
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
