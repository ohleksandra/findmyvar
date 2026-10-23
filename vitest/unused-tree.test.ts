import { describe, expect, test } from 'vitest';
import { buildChildrenMap, descendantsOf, expandWithDescendants } from '../src/shared/unused-tree';
import type { UnusedVariable } from '../src/shared/rpc-types';

function unused(id: string, parentId: string | null = null, usedBy: string[] = []): UnusedVariable {
	return {
		id,
		name: id,
		resolvedType: 'COLOR',
		collectionId: 'c',
		collectionName: 'Semantic',
		isPalette: false,
		parentId,
		usedBy: usedBy.map((u) => ({ id: u, name: u })),
		chains: [],
	};
}

const list = [
	unused('brand-bg', null, ['button-bg', 'card-bg']),
	unused('button-bg', 'brand-bg'),
	unused('card-bg', 'brand-bg', ['card-hover']),
	unused('card-hover', 'card-bg'),
	unused('old/divider'),
];

describe('unused tree helpers', () => {
	test('descendantsOf returns every variable that points to the given one, at any depth', () => {
		const children = buildChildrenMap(list);
		expect(descendantsOf('brand-bg', children).sort()).toEqual([
			'button-bg',
			'card-bg',
			'card-hover',
		]);
		expect(descendantsOf('old/divider', children)).toEqual([]);
	});

	test('expandWithDescendants adds what must be deleted together, without duplicates', () => {
		const children = buildChildrenMap(list);
		expect(expandWithDescendants(['card-bg', 'brand-bg'], children).sort()).toEqual([
			'brand-bg',
			'button-bg',
			'card-bg',
			'card-hover',
		]);
	});
});
