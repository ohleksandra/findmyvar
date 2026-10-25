import type { UnusedVariable } from './rpc-types';

/** Maps each unused variable id to the ids of the unused variables that point to it. */
export function buildChildrenMap(unused: UnusedVariable[]): Map<string, string[]> {
	return new Map(unused.map((variable) => [variable.id, variable.usedBy.map((u) => u.id)]));
}

/** All unused variables that (directly or indirectly) point to `id`. They must be deleted with it. */
export function descendantsOf(id: string, children: Map<string, string[]>): string[] {
	const result: string[] = [];
	const stack = [...(children.get(id) ?? [])];
	const seen = new Set<string>([id]);
	while (stack.length > 0) {
		const next = stack.pop()!;
		if (seen.has(next)) continue;
		seen.add(next);
		result.push(next);
		stack.push(...(children.get(next) ?? []));
	}
	return result;
}

/** Expands a selection so every selected variable brings the variables that point to it. */
export function expandWithDescendants(
	ids: Iterable<string>,
	children: Map<string, string[]>,
): string[] {
	const result = new Set<string>();
	Array.from(ids).forEach((id) => {
		result.add(id);
		descendantsOf(id, children).forEach((descendant) => result.add(descendant));
	});
	return Array.from(result);
}
