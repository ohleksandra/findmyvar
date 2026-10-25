import { describe, expect, test } from 'vitest';
import type { UnusedVariable } from '../src/shared/rpc-types';
import { buildGroups } from '../src/ui/components/unused/unused-tree-model';
import { filterGroup } from '../src/ui/components/unused/unused-filter';

function unused(
	id: string,
	collectionName: string,
	usedBy: string[] = [],
	parentId: string | null = null,
): UnusedVariable {
	return {
		id,
		name: id,
		resolvedType: 'COLOR',
		collectionId: collectionName,
		collectionName,
		isPalette: false,
		parentId,
		usedBy: usedBy.map((u) => ({ id: u, name: u })),
		chains: [],
	};
}

const groups = buildGroups([
	unused('color/brand/old-blue', 'Semantic', ['color/button/old-bg']),
	unused('color/button/old-bg', 'Semantic', [], 'color/brand/old-blue'),
	unused('spacing/legacy-xl', 'Spacing'),
]);
const semantic = groups.find((g) => g.name === 'Semantic')!;
const spacing = groups.find((g) => g.name === 'Spacing')!;

describe('filterGroup', () => {
	test('without a filter, shows the whole tree', () => {
		const shown = filterGroup(semantic, '');
		expect(shown.nodes).toBe(semantic.roots);
		expect(shown.ids).toEqual(semantic.ids);
	});

	test('a collection name shows that whole collection as a tree', () => {
		const shown = filterGroup(semantic, 'semantic');
		expect(shown.nodes).toBe(semantic.roots);
		expect([...shown.ids].sort()).toEqual(['color/brand/old-blue', 'color/button/old-bg']);
		expect(filterGroup(spacing, 'semantic').ids).toEqual([]);
	});

	test('part of a name shows the matching variables as a flat list, nested ones too', () => {
		const shown = filterGroup(semantic, 'button');
		expect(shown.ids).toEqual(['color/button/old-bg']);
		expect(shown.nodes[0].children).toEqual([]);
	});

	test('a variable matches by its own collection, even under a parent from another one', () => {
		const mixed = buildGroups([
			unused('color/brand/old-blue', 'Semantic', ['button/bg']),
			unused('button/bg', 'Components', [], 'color/brand/old-blue'),
		])[0];
		expect(filterGroup(mixed, 'components').ids).toEqual(['button/bg']);
	});

	test('nothing matching shows nothing', () => {
		expect(filterGroup(semantic, 'zzz')).toEqual({ nodes: [], ids: [] });
	});
});
