import { describe, expect, test } from 'vitest';
import { findNodesWithBindingsAsync } from '../src/main/services/node-traverser';

function createNode(
	id: string,
	name: string,
	type: string = 'FRAME',
	options: {
		boundVariables?: Record<string, unknown> | null;
		children?: SceneNode[];
		parent?: BaseNode;
	} = {},
): SceneNode {
	const node = {
		id,
		name,
		type,
		boundVariables: options.boundVariables ?? null,
		children: options.children ?? [],
		parent: options.parent ?? null,
	} as unknown as SceneNode;

	if (options.children) {
		for (const child of options.children) {
			(child as unknown as { parent: BaseNode }).parent = node;
		}
	}

	return node;
}

async function collectNodes(root: SceneNode, cancelled: boolean = false): Promise<SceneNode[]> {
	const results: SceneNode[] = [];
	const signal = { cancelled };
	for await (const node of findNodesWithBindingsAsync(root, signal)) {
		results.push(node);
	}
	return results;
}

describe('findNodesWithBindingsAsync', () => {
	test('yields root node if it has boundVariables', async () => {
		const root = createNode('root', 'Root', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const results = await collectNodes(root);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('root');
	});

	test('does not yield root if it has no boundVariables', async () => {
		const root = createNode('root', 'Root');
		const results = await collectNodes(root);
		expect(results).toHaveLength(0);
	});

	test('yields deeply nested nodes with boundVariables', async () => {
		const leaf = createNode('leaf', 'Leaf', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const mid = createNode('mid', 'Mid', 'FRAME', { children: [leaf] });
		const root = createNode('root', 'Root', 'FRAME', { children: [mid] });

		const results = await collectNodes(root);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('leaf');
	});

	test('yields multiple matching nodes', async () => {
		const child1 = createNode('c1', 'C1', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const child2 = createNode('c2', 'C2', 'RECTANGLE', {
			boundVariables: { strokes: { type: 'VARIABLE_ALIAS', id: 'v2' } },
		});
		const root = createNode('root', 'Root', 'FRAME', { children: [child1, child2] });

		const results = await collectNodes(root);
		expect(results).toHaveLength(2);
		expect(results.map((n) => n.id)).toEqual(['c1', 'c2']);
	});

	test('skips nodes without boundVariables in traversal', async () => {
		const match = createNode('match', 'Match', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const empty1 = createNode('e1', 'Empty1', 'FRAME', { children: [] });
		const empty2 = createNode('e2', 'Empty2', 'FRAME', { children: [match] });
		const root = createNode('root', 'Root', 'FRAME', { children: [empty1, empty2] });

		const results = await collectNodes(root);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('match');
	});

	test('returns empty if signal.cancelled is true initially', async () => {
		const leaf = createNode('leaf', 'Leaf', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const root = createNode('root', 'Root', 'FRAME', { children: [leaf] });

		const results = await collectNodes(root, true);
		expect(results).toHaveLength(0);
	});

	test('traverses wide trees', async () => {
		const children: SceneNode[] = [];
		for (let i = 0; i < 50; i++) {
			children.push(
				createNode(`n${i}`, `Node ${i}`, 'RECTANGLE', {
					boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
				}),
			);
		}
		const root = createNode('root', 'Root', 'FRAME', { children });

		const results = await collectNodes(root);
		expect(results).toHaveLength(50);
	});

	test('does not yield intermediate frames without boundVariables', async () => {
		const leaf = createNode('leaf', 'Leaf', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const frame1 = createNode('f1', 'Frame1', 'FRAME', { children: [leaf] });
		const frame2 = createNode('f2', 'Frame2', 'FRAME', { children: [frame1] });

		const results = await collectNodes(frame2);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('leaf');
	});

	test('yields both frame and child when frame has boundVariables', async () => {
		const leaf = createNode('leaf', 'Leaf', 'RECTANGLE', {
			boundVariables: { fills: { type: 'VARIABLE_ALIAS', id: 'v1' } },
		});
		const frame = createNode('frame', 'Frame', 'FRAME', {
			boundVariables: { width: { type: 'VARIABLE_ALIAS', id: 'v2' } },
			children: [leaf],
		});

		const results = await collectNodes(frame);
		expect(results).toHaveLength(2);
		expect(results.map((n) => n.id)).toEqual(['frame', 'leaf']);
	});
});
