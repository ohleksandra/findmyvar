import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	collectPrototypeVariableIds,
	collectVariableIds,
	extractBindings,
} from '../src/main/services/binding-extractor';

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

describe('collectVariableIds', () => {
	test('collects ids from direct, array, nested-array and object bindings', () => {
		const ids = new Set<string>();
		collectVariableIds(
			{
				width: ALIAS('v-width'),
				fills: [ALIAS('v-fill-0'), ALIAS('v-fill-1')],
				gradient: [[ALIAS('v-stop')]],
				componentProperties: { label: ALIAS('v-label') },
			},
			ids,
		);
		expect([...ids].sort()).toEqual(['v-fill-0', 'v-fill-1', 'v-label', 'v-stop', 'v-width']);
	});

	test('collects ids nested inside style paints', () => {
		const ids = new Set<string>();
		collectVariableIds(
			[
				{
					type: 'SOLID',
					color: { r: 0, g: 0, b: 0 },
					boundVariables: { color: ALIAS('v-paint') },
				},
			],
			ids,
		);
		expect([...ids]).toEqual(['v-paint']);
	});

	test('ignores null, primitives and non-alias objects', () => {
		const ids = new Set<string>();
		collectVariableIds(null, ids);
		collectVariableIds('VARIABLE_ALIAS', ids);
		collectVariableIds({ type: 'VARIABLE_ALIAS' }, ids);
		collectVariableIds({ fills: [] }, ids);
		expect(ids.size).toBe(0);
	});
});

describe('collectPrototypeVariableIds', () => {
	test('collects "Set variable" targets and aliases used in values', () => {
		const ids = new Set<string>();
		collectPrototypeVariableIds(
			[
				{
					trigger: { type: 'ON_CLICK' },
					actions: [
						{
							type: 'SET_VARIABLE',
							variableId: 'v-is-open',
							variableValue: { type: 'VARIABLE_ALIAS', value: ALIAS('v-default') },
						},
					],
				},
			],
			ids,
		);
		expect([...ids].sort()).toEqual(['v-default', 'v-is-open']);
	});

	test('finds aliases deep inside conditional expressions', () => {
		const ids = new Set<string>();
		collectPrototypeVariableIds(
			[
				{
					actions: [
						{
							type: 'CONDITIONAL',
							conditionalBlocks: [
								{
									condition: {
										type: 'EXPRESSION',
										value: {
											expressionFunction: 'AND',
											expressionArguments: [
												{
													type: 'EXPRESSION',
													value: {
														expressionFunction: 'EQUALS',
														expressionArguments: [
															{
																type: 'VARIABLE_ALIAS',
																value: ALIAS('v-logged-in'),
															},
															{ type: 'BOOLEAN', value: true },
														],
													},
												},
											],
										},
									},
									actions: [
										{
											type: 'SET_VARIABLE',
											variableId: 'v-cart',
											variableValue: { value: 0 },
										},
									],
								},
							],
						},
					],
				},
			],
			ids,
		);
		expect([...ids].sort()).toEqual(['v-cart', 'v-logged-in']);
	});

	test('ignores actions without variables', () => {
		const ids = new Set<string>();
		collectPrototypeVariableIds(
			[
				{
					actions: [
						{ type: 'NODE', destinationId: '1:2' },
						{ type: 'SET_VARIABLE', variableId: null },
					],
				},
			],
			ids,
		);
		expect(ids.size).toBe(0);
	});
});
