import { describe, expect, test } from 'vitest';
import { buildNodePath } from '../src/main/services/node-path-builder';

function createNode(
	id: string,
	name: string,
	type: string = 'FRAME',
	parent: BaseNode | null = null,
): SceneNode {
	return {
		id,
		name,
		type,
		parent,
	} as unknown as SceneNode;
}

function createPage(id: string, name: string): PageNode {
	return { id, name, type: 'PAGE' } as unknown as PageNode;
}

describe('buildNodePath', () => {
	test('returns empty string for node without parent', () => {
		const node = { parent: null } as unknown as SceneNode;
		expect(buildNodePath(node)).toBe('');
	});

	test('returns parent name for single-level depth', () => {
		const page = createPage('page-1', 'Page 1');
		const parent = createNode('frame-1', 'Header', 'FRAME', page);
		const node = createNode('rect-1', 'Button', 'RECTANGLE', parent);
		expect(buildNodePath(node)).toBe('Header');
	});

	test('returns "Highest/.../Parent" format for multi-level depth', () => {
		const page = createPage('page-1', 'Page 1');
		const grandparent = createNode('g', 'App Shell', 'FRAME', page);
		const parent = createNode('p', 'Header', 'FRAME', grandparent);
		const node = createNode('n', 'Logo', 'INSTANCE', parent);
		expect(buildNodePath(node)).toBe('App Shell/.../Header');
	});

	test('stops traversal at SECTION boundary', () => {
		const page = createPage('page-1', 'Page 1');
		const section = createNode('s', 'Section', 'SECTION', page);
		const parent = createNode('p', 'Frame', 'FRAME', section);
		const node = createNode('n', 'Node', 'RECTANGLE', parent);
		expect(buildNodePath(node)).toBe('Frame');
	});

	test('trims whitespace from names', () => {
		const page = createPage('page-1', 'Page 1');
		const grandparent = createNode('g', '  Shell  ', 'FRAME', page);
		const parent = createNode('p', '  Header  ', 'FRAME', grandparent);
		const node = createNode('n', 'Node', 'RECTANGLE', parent);
		expect(buildNodePath(node)).toBe('Shell/.../Header');
	});

	test('skips ancestors with empty names to find highest non-empty name', () => {
		const page = createPage('page-1', 'Page 1');
		const empty1 = createNode('e1', '', 'FRAME', page);
		const grandparent = createNode('g', 'Shell', 'FRAME', empty1);
		const parent = createNode('p', 'Header', 'FRAME', grandparent);
		const node = createNode('n', 'Node', 'RECTANGLE', parent);
		expect(buildNodePath(node)).toBe('Shell/.../Header');
	});

	test('returns empty string when all ancestors have empty names', () => {
		const page = createPage('page-1', 'Page 1');
		const empty1 = createNode('e1', '  ', 'FRAME', page);
		const empty2 = createNode('e2', '', 'FRAME', empty1);
		const node = createNode('n', 'Node', 'RECTANGLE', empty2);
		expect(buildNodePath(node)).toBe('');
	});

	describe('memoization via pathCache', () => {
		test('reuses cached path for siblings', () => {
			const page = createPage('page-1', 'Page 1');
			const grandparent = createNode('g', 'Shell', 'FRAME', page);
			const parent = createNode('p', 'Header', 'FRAME', grandparent);
			const sibling1 = createNode('s1', 'Node 1', 'RECTANGLE', parent);
			const sibling2 = createNode('s2', 'Node 2', 'RECTANGLE', parent);

			const pathCache = new Map<string, string>();
			const path1 = buildNodePath(sibling1, pathCache);
			const path2 = buildNodePath(sibling2, pathCache);

			expect(path1).toBe('Shell/.../Header');
			expect(path2).toBe('Shell/.../Header');
		});

		test('stores result in pathCache', () => {
			const page = createPage('page-1', 'Page 1');
			const parent = createNode('p', 'Frame', 'FRAME', page);
			const node = createNode('n', 'Node', 'RECTANGLE', parent);

			const pathCache = new Map<string, string>();
			buildNodePath(node, pathCache);

			expect(pathCache.has(parent.id)).toBe(true);
			expect(pathCache.get(parent.id)).toBe('Frame');
		});

		test('works without pathCache', () => {
			const page = createPage('page-1', 'Page 1');
			const parent = createNode('p', 'Frame', 'FRAME', page);
			const node = createNode('n', 'Node', 'RECTANGLE', parent);

			expect(buildNodePath(node)).toBe('Frame');
		});
	});
});
