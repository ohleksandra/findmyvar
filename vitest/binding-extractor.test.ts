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

describe('extractBindings: bindings outside boundVariables', () => {
	const GRADIENT = (stopVariableIds: (string | null)[]) => ({
		type: 'GRADIENT_LINEAR',
		gradientTransform: [
			[1, 0, 0],
			[0, 1, 0],
		],
		gradientStops: stopVariableIds.map((id, i) => ({
			position: i,
			color: { r: 0, g: 0, b: 0, a: 1 },
			...(id ? { boundVariables: { color: ALIAS(id) } } : {}),
		})),
	});

	function nodeWith(props: Record<string, unknown>): SceneNode {
		return {
			id: 'node-1',
			name: 'Node',
			type: 'RECTANGLE',
			boundVariables: {},
			...props,
		} as unknown as SceneNode;
	}

	test('finds a variable bound to a gradient stop', () => {
		const node = nodeWith({ fills: [GRADIENT([null, 'var-1'])] });
		expect(extractBindings(node, 'var-1')).toEqual(['fills[0].gradientStops[1].color']);
	});

	test('finds gradient stops in strokes', () => {
		const node = nodeWith({ strokes: [GRADIENT(['var-1'])] });
		expect(extractBindings(node, 'var-1')).toEqual(['strokes[0].gradientStops[0].color']);
	});

	test('reports a solid fill once, although Figma lists it on the node and on the paint', () => {
		const node = nodeWith({
			boundVariables: { fills: [ALIAS('var-1')] },
			fills: [{ type: 'SOLID', boundVariables: { color: ALIAS('var-1') } }],
		});
		expect(extractBindings(node, 'var-1')).toEqual(['fills[0]']);
	});

	test('finds effect and layout grid fields', () => {
		const node = nodeWith({
			effects: [{ type: 'DROP_SHADOW', boundVariables: { radius: ALIAS('var-1') } }],
			layoutGrids: [{ pattern: 'COLUMNS', boundVariables: { gutterSize: ALIAS('var-1') } }],
		});
		expect(extractBindings(node, 'var-1')).toEqual([
			'effects[0].radius',
			'layoutGrids[0].gutterSize',
		]);
	});

	test('reads each styled range when text has several fills', () => {
		const getStyledTextSegments = vi.fn(() => [
			{ characters: 'Hello ', fills: [{ type: 'SOLID' }] },
			{ characters: 'world', fills: [GRADIENT(['var-1'])] },
		]);
		const node = nodeWith({
			type: 'TEXT',
			fills: Symbol('mixed'),
			getStyledTextSegments,
		});

		expect(extractBindings(node, 'var-1')).toEqual([
			'textRangeFills[1][0].gradientStops[0].color',
		]);
		expect(getStyledTextSegments).toHaveBeenCalledWith(['fills']);
	});

	test('finds the default value of a component property', () => {
		const node = nodeWith({
			type: 'COMPONENT_SET',
			componentPropertyDefinitions: {
				'Label#1:2': {
					type: 'TEXT',
					defaultValue: 'Button',
					boundVariables: { value: ALIAS('var-1') },
				},
				'Show icon#1:3': { type: 'BOOLEAN', defaultValue: true },
			},
		});
		expect(extractBindings(node, 'var-1')).toEqual([
			'componentPropertyDefinitions.Label#1:2.value',
		]);
	});

	test('does not read component properties on a variant, where Figma throws', () => {
		const variant = nodeWith({ type: 'COMPONENT', parent: { type: 'COMPONENT_SET' } });
		Object.defineProperty(variant, 'componentPropertyDefinitions', {
			get: () => {
				throw new Error(
					'Can only get definitions of a component set or non-variant component',
				);
			},
		});
		expect(extractBindings(variant, 'var-1')).toBeNull();
	});

	test('skips a component set whose definitions cannot be read', () => {
		const node = nodeWith({ type: 'COMPONENT_SET', fills: [GRADIENT(['var-1'])] });
		Object.defineProperty(node, 'componentPropertyDefinitions', {
			get: () => {
				throw new Error('Component set has existing errors');
			},
		});
		expect(extractBindings(node, 'var-1')).toEqual(['fills[0].gradientStops[0].color']);
	});
});

describe('extractBindings: Motion and deep nesting', () => {
	test('finds Motion easing once, although `animations` repeats the manual keyframes', () => {
		const keyframes = [{ id: 'k1', timelinePosition: 0, easing: ALIAS('var-1') }];
		const node = {
			id: 'node-1',
			name: 'Node',
			type: 'FRAME',
			boundVariables: {},
			manualKeyframeTracks: { OPACITY: { id: 't1', keyframes } },
			animations: { OPACITY: { tracks: [{ keyframes }] } },
		} as unknown as SceneNode;

		expect(extractBindings(node, 'var-1')).toEqual([
			'manualKeyframeTracks.OPACITY.keyframes[0].easing',
		]);
	});

	test('finds an alias nested deeper than six levels', () => {
		const node = {
			id: 'node-1',
			name: 'Node',
			type: 'FRAME',
			boundVariables: {},
			effects: [
				{ type: 'SHADER', properties: { a: { b: { c: { d: { e: ALIAS('var-1') } } } } } },
			],
		} as unknown as SceneNode;

		expect(extractBindings(node, 'var-1')).toEqual(['effects[0].properties.a.b.c.d.e']);
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
