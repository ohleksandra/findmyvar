import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { extractBindings } from '../src/main/services/binding-extractor';

function createMockNode(
	options: {
		boundVariables?: Record<string, unknown> | null;
	} = {},
): SceneNode {
	return {
		id: 'node-1',
		name: 'MockNode',
		type: 'RECTANGLE',
		boundVariables: options.boundVariables ?? null,
	} as unknown as SceneNode;
}

const ALIAS = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

describe('extractBindings', () => {
	describe('returns null for nodes without boundVariables', () => {
		test('node has no boundVariables property', () => {
			const node = { id: 'n', name: 'N', type: 'RECTANGLE' } as unknown as SceneNode;
			expect(extractBindings(node, 'var-1')).toBeNull();
		});

		test('boundVariables is null', () => {
			const node = createMockNode({ boundVariables: null });
			expect(extractBindings(node, 'var-1')).toBeNull();
		});

		test('boundVariables is empty object', () => {
			const node = createMockNode({ boundVariables: {} });
			expect(extractBindings(node, 'var-1')).toBeNull();
		});
	});

	describe('scalar VariableAlias', () => {
		test('returns field name when alias id matches', () => {
			const node = createMockNode({
				boundVariables: { cornerRadius: ALIAS('var-1') },
			});
			expect(extractBindings(node, 'var-1')).toEqual(['cornerRadius']);
		});

		test('returns null when alias id does not match', () => {
			const node = createMockNode({
				boundVariables: { cornerRadius: ALIAS('var-2') },
			});
			expect(extractBindings(node, 'var-1')).toBeNull();
		});
	});

	describe('array of VariableAlias', () => {
		test('returns indexed field names for matching entries', () => {
			const node = createMockNode({
				boundVariables: {
					fills: [ALIAS('var-1'), ALIAS('var-2'), ALIAS('var-1')],
				},
			});
			expect(extractBindings(node, 'var-1')).toEqual(['fills[0]', 'fills[2]']);
		});

		test('returns null when no entries match', () => {
			const node = createMockNode({
				boundVariables: { fills: [ALIAS('var-2'), ALIAS('var-3')] },
			});
			expect(extractBindings(node, 'var-1')).toBeNull();
		});
	});

	describe('nested array (VariableAlias[][])', () => {
		test('returns nested indices for matches in 2D arrays', () => {
			const node = createMockNode({
				boundVariables: {
					fills: [[ALIAS('var-2'), ALIAS('var-1')], [ALIAS('var-3')]],
				},
			});
			expect(extractBindings(node, 'var-1')).toEqual(['fills[0][1]']);
		});
	});

	describe('object map (componentProperties)', () => {
		test('returns dotted field name for matching prop', () => {
			const node = createMockNode({
				boundVariables: {
					componentProperties: { primary: ALIAS('var-1'), secondary: ALIAS('var-2') },
				},
			});
			expect(extractBindings(node, 'var-1')).toEqual(['componentProperties.primary']);
		});

		test('returns null when no prop matches', () => {
			const node = createMockNode({
				boundVariables: {
					componentProperties: { primary: ALIAS('var-2') },
				},
			});
			expect(extractBindings(node, 'var-1')).toBeNull();
		});
	});

	describe('mixed bindings', () => {
		test('collects matches from multiple fields', () => {
			const node = createMockNode({
				boundVariables: {
					cornerRadius: ALIAS('var-1'),
					fills: [ALIAS('var-2'), ALIAS('var-1')],
					strokes: [ALIAS('var-3')],
				},
			});
			expect(extractBindings(node, 'var-1')).toEqual(['cornerRadius', 'fills[1]']);
		});
	});

	describe('ignores non-VARIABLE_ALIAS objects', () => {
		test('skips objects without type=VARIABLE_ALIAS', () => {
			const node = createMockNode({
				boundVariables: { cornerRadius: { id: 'var-1' } },
			});
			expect(extractBindings(node, 'var-1')).toBeNull();
		});

		test('skips non-alias items in arrays', () => {
			const node = createMockNode({
				boundVariables: {
					fills: [{ id: 'var-1' }, ALIAS('var-2')],
				},
			});
			expect(extractBindings(node, 'var-1')).toBeNull();
		});
	});
});
