import { describe, expect, test } from 'vitest';
import { buildGroups, type UnusedNode } from '../src/ui/components/unused/unused-tree-model';
import type { UnusedVariable } from '../src/shared/rpc-types';

function unused(
	id: string,
	parentId: string | null = null,
	usedBy: string[] = [],
	isPalette = false,
): UnusedVariable {
	return {
		id,
		name: id,
		resolvedType: 'FLOAT',
		collectionId: isPalette ? 'p' : 'c',
		collectionName: isPalette ? 'Primitives' : 'Grid',
		isPalette,
		parentId,
		usedBy: usedBy.map((u) => ({ id: u, name: u })),
		chains: [],
	};
}

function find(nodes: UnusedNode[], id: string, parentId: string | null): UnusedNode | undefined {
	for (const node of nodes) {
		if (node.variable.id === id && node.parentId === parentId) return node;
		const found = find(node.children, id, parentId);
		if (found) return found;
	}
	return undefined;
}

// sm/right points to a different grid variable in each mode.
const modes = [
	unused('wide/right', null, ['sm/right']),
	unused('narrow/right', null, ['sm/right']),
	unused('condensed/right', null, ['sm/right']),
	unused('sm/right', 'wide/right'),
];

describe('buildGroups', () => {
	test('nests a variable under every variable it points to', () => {
		const [group] = buildGroups(modes);
		expect(group.roots.map((r) => r.variable.id)).toEqual([
			'wide/right',
			'narrow/right',
			'condensed/right',
		]);
		for (const root of group.roots) {
			expect(root.children.map((c) => c.variable.id)).toEqual(['sm/right']);
		}
	});

	test('counts a shared variable once', () => {
		const [group] = buildGroups(modes);
		expect(group.ids).toEqual(['wide/right', 'sm/right', 'narrow/right', 'condensed/right']);
	});

	test('a palette value never holds a non-palette variable', () => {
		const groups = buildGroups([
			unused('grid/base', null, ['sm/right']),
			unused('space/16', null, ['sm/right'], true),
			unused('sm/right', 'grid/base'),
		]);
		const palette = groups.find((g) => g.isPalette)!;
		expect(palette.roots[0].children).toEqual([]);
		expect(find(groups[0].roots, 'sm/right', 'grid/base')).toBeDefined();
	});

	test('stops at a loop between modes instead of recursing forever', () => {
		const [group] = buildGroups([
			unused('root', null, ['a']),
			unused('a', 'root', ['b']),
			unused('b', 'a', ['a']),
		]);
		const a = group.roots[0].children[0];
		expect(a.children.map((c) => c.variable.id)).toEqual(['b']);
		expect(a.children[0].children).toEqual([]);
	});
});
