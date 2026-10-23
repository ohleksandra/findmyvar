import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { UnusedVariableScanner } from '../src/main/services/unused-variable-scanner';
import { acquireTraversalMode, resetTraversalMode } from '../src/main/services/traversal-mode';
import type { UnusedScanResult } from '../src/shared/rpc-types';

const mockNotify = vi.fn();

vi.mock('../src/shared/logger', () => ({
	logger: {
		log: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	formatDuration: (ms: number) => `${ms}ms`,
}));

const ALIAS = (id: string) => ({ type: 'VARIABLE_ALIAS', id });
const NAVY = { r: 0.047, g: 0.267, b: 0.486, a: 1 };

function node(
	id: string,
	boundVariables: Record<string, unknown> | null,
	children: unknown[] = [],
) {
	return { id, name: id, type: 'FRAME', boundVariables, children };
}

interface MockVariable {
	id: string;
	name: string;
	resolvedType: string;
	variableCollectionId: string;
	valuesByMode: Record<string, unknown>;
	hiddenFromPublishing: boolean;
	getPublishStatusAsync: () => Promise<string>;
	remove: ReturnType<typeof vi.fn>;
}

function variable(
	id: string,
	value: unknown,
	options: { collection?: string; published?: boolean } = {},
): MockVariable {
	return {
		id,
		name: id,
		resolvedType: 'COLOR',
		variableCollectionId: options.collection ?? 'c-sem',
		valuesByMode: { m: value },
		hiddenFromPublishing: false,
		getPublishStatusAsync: async () => (options.published ? 'CURRENT' : 'UNPUBLISHED'),
		remove: vi.fn(),
	};
}

function setupFigma(options: {
	variables: MockVariable[];
	pages: { name: string; children: unknown[] }[];
	paintStyles?: unknown[];
	textStyles?: unknown[];
}) {
	const listeners: ((event: unknown) => void)[] = [];
	const mockFigma = {
		skipInvisibleInstanceChildren: true,
		loadAllPagesAsync: vi.fn(async () => {}),
		root: {
			children: options.pages.map((p, i) => ({ id: `page-${i}`, ...p })),
		},
		variables: {
			getLocalVariablesAsync: vi.fn(async () => options.variables),
			getLocalVariableCollectionsAsync: vi.fn(async () => [
				{
					id: 'c-sem',
					name: 'Semantic',
					modes: [{ modeId: 'm', name: 'Value' }],
					defaultModeId: 'm',
					isExtension: false,
				},
				{
					id: 'c-prim',
					name: 'Primitives',
					modes: [{ modeId: 'm', name: 'Value' }],
					defaultModeId: 'm',
					isExtension: false,
				},
			]),
			getVariableByIdAsync: vi.fn(
				async (id: string) => options.variables.find((v) => v.id === id) ?? null,
			),
		},
		getLocalPaintStylesAsync: vi.fn(async () => options.paintStyles ?? []),
		getLocalTextStylesAsync: vi.fn(async () => options.textStyles ?? []),
		getLocalEffectStylesAsync: vi.fn(async () => []),
		getLocalGridStylesAsync: vi.fn(async () => []),
		saveVersionHistoryAsync: vi.fn(async () => ({ id: 'v1' })),
		commitUndo: vi.fn(),
		on: vi.fn((_event: string, cb: (event: unknown) => void) => listeners.push(cb)),
	};
	vi.stubGlobal('figma', mockFigma);
	return { mockFigma, emitChange: (event: unknown) => listeners.forEach((cb) => cb(event)) };
}

function lastResult(): UnusedScanResult {
	const call = mockNotify.mock.calls.filter((c) => c[0] === 'unusedScan.complete').pop();
	expect(call).toBeDefined();
	return call![1].result;
}

const unusedIds = () =>
	lastResult()
		.unused.map((v) => v.id)
		.sort();

describe('UnusedVariableScanner', () => {
	let scanner: UnusedVariableScanner;

	beforeEach(() => {
		vi.clearAllMocks();
		resetTraversalMode();
		scanner = new UnusedVariableScanner({
			notify: (...args: unknown[]) => mockNotify(...args),
		} as never);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('reports variables that no layer binds, directly or through an alias, as unused', async () => {
		setupFigma({
			variables: [
				variable('blue/500', NAVY, { collection: 'c-prim' }),
				variable('button-bg', ALIAS('blue/500')),
				variable('old-bg', NAVY),
			],
			pages: [
				{
					name: 'Page 1',
					children: [
						node('frame', null, [node('child', { fills: [ALIAS('button-bg')] })]),
					],
				},
			],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-bg']);
		expect(lastResult().totalVariables).toBe(3);
	});

	test('counts variables bound to styles as used', async () => {
		setupFigma({
			variables: [
				variable('v-paint', NAVY),
				variable('v-text', 16),
				variable('v-unused', NAVY),
			],
			pages: [{ name: 'Page 1', children: [] }],
			paintStyles: [
				{ paints: [{ type: 'SOLID', boundVariables: { color: ALIAS('v-paint') } }] },
			],
			textStyles: [{ boundVariables: { fontSize: ALIAS('v-text') } }],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['v-unused']);
	});

	test('never lists published variables, nor what they point to', async () => {
		setupFigma({
			variables: [
				variable('blue/500', NAVY, { collection: 'c-prim' }),
				variable('brand-accent', ALIAS('blue/500'), { published: true }),
				variable('old-bg', NAVY),
			],
			pages: [{ name: 'Page 1', children: [] }],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-bg']);
		expect(lastResult().publishedNames).toEqual(['brand-accent']);
	});

	test('counts variables used only in prototype interactions as used', async () => {
		const button = {
			...node('button', null),
			reactions: [
				{
					trigger: { type: 'ON_CLICK' },
					actions: [
						{
							type: 'SET_VARIABLE',
							variableId: 'is-open',
							variableValue: { value: true },
						},
						{
							type: 'CONDITIONAL',
							conditionalBlocks: [
								{
									condition: {
										type: 'VARIABLE_ALIAS',
										value: ALIAS('is-logged-in'),
									},
									actions: [],
								},
							],
						},
					],
				},
			],
		};
		setupFigma({
			variables: [
				variable('is-open', true),
				variable('is-logged-in', false),
				variable('old-flag', false),
			],
			pages: [{ name: 'Page 1', children: [button] }],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-flag']);
	});

	test('keeps including hidden layers when a search runs during the scan', async () => {
		const { mockFigma } = setupFigma({
			variables: [variable('v-1', NAVY)],
			pages: [{ name: 'Page 1', children: [node('a', null)] }],
		});
		let valueAfterSearch: boolean | undefined;
		mockFigma.loadAllPagesAsync.mockImplementation(async () => {
			// A search on the Search tab starts and finishes while the scan runs.
			const releaseSearch = acquireTraversalMode('fast');
			releaseSearch();
			valueAfterSearch = mockFigma.skipInvisibleInstanceChildren;
		});

		await scanner.scan('scan-1');

		expect(valueAfterSearch).toBe(false);
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);
	});

	test('includes hidden instance children and restores the setting afterwards', async () => {
		const { mockFigma } = setupFigma({
			variables: [],
			pages: [{ name: 'Page 1', children: [] }],
		});
		let valueDuringScan: boolean | undefined;
		mockFigma.getLocalPaintStylesAsync.mockImplementation(async () => {
			valueDuringScan = mockFigma.skipInvisibleInstanceChildren;
			return [];
		});

		await scanner.scan('scan-1');

		expect(valueDuringScan).toBe(false);
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);
	});

	test('does not report results after being cancelled', async () => {
		const { mockFigma } = setupFigma({
			variables: [variable('v-1', NAVY)],
			pages: [{ name: 'Page 1', children: [node('a', null)] }],
		});
		mockFigma.loadAllPagesAsync.mockImplementation(async () => {
			scanner.cancelScan();
		});

		await scanner.scan('scan-1');

		expect(mockNotify.mock.calls.some((c) => c[0] === 'unusedScan.complete')).toBe(false);
	});

	test('notifies an error when the Figma API throws', async () => {
		const { mockFigma } = setupFigma({ variables: [], pages: [] });
		mockFigma.getLocalPaintStylesAsync.mockRejectedValue(new Error('boom'));

		await scanner.scan('scan-1');

		expect(mockNotify).toHaveBeenCalledWith('unusedScan.error', {
			scanId: 'scan-1',
			error: 'boom',
		});
		expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);
	});

	describe('noticing changes after a scan', () => {
		const staleNotices = () =>
			mockNotify.mock.calls.filter((c) => c[0] === 'unusedScan.stale').length;

		async function scanWithOneUnused() {
			const figmaMock = setupFigma({
				variables: [variable('button-bg', NAVY), variable('old-bg', NAVY)],
				pages: [
					{
						name: 'Page 1',
						children: [node('button', { fills: [ALIAS('button-bg')] })],
					},
				],
			});
			await scanner.scan('scan-1');
			expect(unusedIds()).toEqual(['old-bg']);
			return figmaMock;
		}

		test('marks results out of date when an unused variable gets bound', async () => {
			const { emitChange } = await scanWithOneUnused();

			emitChange({
				documentChanges: [
					{
						type: 'PROPERTY_CHANGE',
						node: node('card', { fills: [ALIAS('old-bg')] }),
						properties: ['fills'],
					},
				],
			});

			expect(mockNotify).toHaveBeenCalledWith('unusedScan.stale', { scanId: 'scan-1' });
			await expect(scanner.deleteVariables(['old-bg'])).rejects.toThrow(
				'changed since the scan',
			);
		});

		test('ignores binding a variable the scan already counted as used', async () => {
			const { emitChange } = await scanWithOneUnused();

			emitChange({
				documentChanges: [
					{
						type: 'PROPERTY_CHANGE',
						node: node('card', { fills: [ALIAS('button-bg')] }),
						properties: ['fills'],
					},
				],
			});

			expect(staleNotices()).toBe(0);
		});

		test('ignores moving, adding or deleting layers that use no unused variable', async () => {
			const { emitChange } = await scanWithOneUnused();

			emitChange({
				documentChanges: [
					{ type: 'PROPERTY_CHANGE', node: node('button', {}), properties: ['x', 'y'] },
					{ type: 'CREATE', node: node('copy', {}, [node('label', {})]) },
					{ type: 'DELETE', node: { id: 'gone', type: 'FRAME', removed: true } },
					{
						type: 'PROPERTY_CHANGE',
						node: { id: 'gone', type: 'FRAME', removed: true },
						properties: ['fills'],
					},
					{ type: 'STYLE_DELETE', style: null },
				],
			});

			expect(staleNotices()).toBe(0);
		});

		test("notices an unused variable inside a pasted layer's children", async () => {
			const { emitChange } = await scanWithOneUnused();
			const hero = {
				...node('hero', {}),
				fills: [
					{
						type: 'GRADIENT_LINEAR',
						gradientStops: [
							{
								position: 0,
								color: NAVY,
								boundVariables: { color: ALIAS('old-bg') },
							},
						],
					},
				],
			};

			emitChange({ documentChanges: [{ type: 'CREATE', node: node('pasted', {}, [hero]) }] });

			expect(staleNotices()).toBe(1);
		});

		test('notices a style that starts using an unused variable', async () => {
			const { emitChange } = await scanWithOneUnused();

			emitChange({
				documentChanges: [
					{
						type: 'STYLE_PROPERTY_CHANGE',
						style: {
							paints: [{ type: 'SOLID', boundVariables: { color: ALIAS('old-bg') } }],
						},
						properties: ['paints'],
					},
				],
			});

			expect(staleNotices()).toBe(1);
		});

		test('counts a variable bound while the scan runs as used', async () => {
			const { mockFigma, emitChange } = setupFigma({
				variables: [variable('new-bg', NAVY), variable('old-bg', NAVY)],
				pages: [{ name: 'Page 1', children: [] }],
			});
			// The scan is past the layer when someone binds `new-bg` to it.
			mockFigma.getLocalPaintStylesAsync.mockImplementation(async () => {
				emitChange({
					documentChanges: [
						{
							type: 'PROPERTY_CHANGE',
							node: node('card', { fills: [ALIAS('new-bg')] }),
							properties: ['fills'],
						},
					],
				});
				return [];
			});

			await scanner.scan('scan-1');

			expect(unusedIds()).toEqual(['old-bg']);
		});
	});

	test('counts variables used only in gradient stops or component property defaults as used', async () => {
		const banner = {
			...node('banner', {}),
			fills: [
				{
					type: 'GRADIENT_LINEAR',
					gradientStops: [
						{
							position: 0,
							color: NAVY,
							boundVariables: { color: ALIAS('gradient-start') },
						},
						{ position: 1, color: NAVY },
					],
				},
			],
		};
		const buttonSet = {
			...node('button-set', {}),
			type: 'COMPONENT_SET',
			componentPropertyDefinitions: {
				'Label#1:2': {
					type: 'TEXT',
					defaultValue: 'Button',
					boundVariables: { value: ALIAS('button-label') },
				},
			},
		};
		setupFigma({
			variables: [
				variable('gradient-start', NAVY),
				variable('button-label', 'Button'),
				variable('old-bg', NAVY),
			],
			pages: [{ name: 'Page 1', children: [banner, buttonSet] }],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-bg']);
	});

	test('counts variables bound to gradient stops in paint styles as used', async () => {
		setupFigma({
			variables: [variable('gradient-end', NAVY), variable('old-bg', NAVY)],
			pages: [{ name: 'Page 1', children: [] }],
			paintStyles: [
				{
					paints: [
						{
							type: 'GRADIENT_RADIAL',
							gradientStops: [
								{ position: 0, color: NAVY },
								{
									position: 1,
									color: NAVY,
									boundVariables: { color: ALIAS('gradient-end') },
								},
							],
						},
					],
				},
			],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-bg']);
	});

	describe('changes that race the scan or the delete', () => {
		const staleNotices = () =>
			mockNotify.mock.calls.filter((c) => c[0] === 'unusedScan.stale').length;
		const bind = (id: string, variableId: string, properties = ['fills']) => ({
			documentChanges: [
				{
					type: 'PROPERTY_CHANGE',
					node: node(id, { fills: [ALIAS(variableId)] }),
					properties,
				},
			],
		});

		test('a variable bound while the scan analyses its findings is not deletable', async () => {
			const vars = [variable('late', NAVY)];
			const { emitChange } = setupFigma({
				variables: vars,
				pages: [{ name: 'Page 1', children: [] }],
			});
			// The last step asks Figma whether each candidate is published. Someone binds `late` meanwhile.
			vars[0].getPublishStatusAsync = async () => {
				emitChange(bind('card', 'late'));
				return 'UNPUBLISHED';
			};

			await scanner.scan('scan-1');

			expect(unusedIds()).toEqual(['late']);
			expect(staleNotices()).toBe(1);
			await expect(scanner.deleteVariables(['late'])).rejects.toThrow(
				'changed since the scan',
			);
			expect(vars[0].remove).not.toHaveBeenCalled();
		});

		test('a variable bound while the version saves is not deleted', async () => {
			const vars = [variable('v', NAVY)];
			const { mockFigma, emitChange } = setupFigma({
				variables: vars,
				pages: [{ name: 'Page 1', children: [] }],
			});
			await scanner.scan('scan-1');
			mockFigma.saveVersionHistoryAsync.mockImplementation(async () => {
				emitChange(bind('card', 'v'));
				return { id: 'v1' };
			});

			await expect(scanner.deleteVariables(['v'])).rejects.toThrow('changed since the scan');
			expect(vars[0].remove).not.toHaveBeenCalled();
		});

		test('a bound layer moved into a part the scan already walked still counts', async () => {
			const moved = node('moved', { fills: [ALIAS('v')] });
			const walkedChildren: unknown[] = [];
			const pendingChildren: unknown[] = [moved];
			let emitChange: (event: unknown) => void = () => {};
			// Reading this layer, in the walked frame, is when someone drags `moved` into that frame.
			const trigger = {
				...node('trigger', {}),
				get boundVariables() {
					if (pendingChildren.includes(moved)) {
						pendingChildren.splice(pendingChildren.indexOf(moved), 1);
						walkedChildren.push(moved);
						emitChange({
							documentChanges: [
								{
									type: 'PROPERTY_CHANGE',
									node: moved,
									properties: ['parent', 'x', 'y'],
								},
							],
						});
					}
					return {};
				},
			};
			walkedChildren.push(trigger);
			const walked = {
				...node('walked', {}),
				get children() {
					return walkedChildren.slice();
				},
			};
			const pending = {
				...node('pending', {}),
				get children() {
					return pendingChildren.slice();
				},
			};
			({ emitChange } = setupFigma({
				variables: [variable('v', NAVY), variable('old-bg', NAVY)],
				pages: [{ name: 'Page 1', children: [walked, pending] }],
			}));

			await scanner.scan('scan-1');

			expect(unusedIds()).toEqual(['old-bg']);
		});

		test('a layer deleted during the scan is skipped instead of failing the scan', async () => {
			const deleted = {
				id: 'gone',
				name: 'gone',
				type: 'FRAME',
				removed: true,
				children: [],
				get boundVariables() {
					throw new Error('The node (gone) does not exist');
				},
			};
			setupFigma({
				variables: [variable('v', NAVY)],
				pages: [{ name: 'Page 1', children: [node('frame', {}, [deleted])] }],
			});

			await scanner.scan('scan-1');

			expect(mockNotify).not.toHaveBeenCalledWith('unusedScan.error', expect.anything());
			expect(unusedIds()).toEqual(['v']);
		});

		test('a change that cannot be read marks results out of date instead of being skipped', async () => {
			const { emitChange } = setupFigma({
				variables: [variable('v', NAVY)],
				pages: [{ name: 'Page 1', children: [] }],
			});
			await scanner.scan('scan-1');
			const unreadable = {
				...node('label', {}),
				type: 'TEXT',
				fills: Symbol('mixed'),
				getStyledTextSegments: () => {
					throw new Error('Unexpected error');
				},
			};

			expect(() =>
				emitChange({
					documentChanges: [
						{ type: 'PROPERTY_CHANGE', node: unreadable, properties: ['fills'] },
					],
				}),
			).not.toThrow();
			expect(staleNotices()).toBe(1);
			await expect(scanner.deleteVariables(['v'])).rejects.toThrow('changed since the scan');
		});

		test('a change that cannot be read during the scan makes its result out of date', async () => {
			const { mockFigma, emitChange } = setupFigma({
				variables: [variable('v', NAVY)],
				pages: [{ name: 'Page 1', children: [] }],
			});
			mockFigma.getLocalPaintStylesAsync.mockImplementation(async () => {
				emitChange({
					documentChanges: [
						{
							type: 'PROPERTY_CHANGE',
							node: {
								...node('broken', {}),
								get fills() {
									throw new Error('Unexpected error');
								},
							},
							properties: ['fills'],
						},
					],
				});
				return [];
			});

			await scanner.scan('scan-1');

			expect(staleNotices()).toBe(1);
		});

		test('changes on layers deleted right after are ignored', async () => {
			const { emitChange } = setupFigma({
				variables: [variable('v', NAVY)],
				pages: [{ name: 'Page 1', children: [] }],
			});
			await scanner.scan('scan-1');
			const deleted = {
				id: 'gone',
				type: 'FRAME',
				removed: true,
				get boundVariables() {
					throw new Error('The node (gone) does not exist');
				},
			};

			emitChange({
				documentChanges: [
					{ type: 'CREATE', node: deleted },
					{ type: 'PROPERTY_CHANGE', node: deleted, properties: ['fills', 'parent'] },
				],
			});

			expect(staleNotices()).toBe(0);
		});

		test('a moved frame brings the variables of its children', async () => {
			const { emitChange } = setupFigma({
				variables: [variable('v', NAVY)],
				pages: [{ name: 'Page 1', children: [] }],
			});
			await scanner.scan('scan-1');

			emitChange({
				documentChanges: [
					{
						type: 'PROPERTY_CHANGE',
						node: node('card', {}, [node('icon', { fills: [ALIAS('v')] })]),
						properties: ['parent'],
					},
				],
			});

			expect(staleNotices()).toBe(1);
		});

		test('pasted layers are read with hidden instance layers included', async () => {
			const { mockFigma, emitChange } = setupFigma({
				variables: [variable('v', NAVY)],
				pages: [{ name: 'Page 1', children: [] }],
			});
			await scanner.scan('scan-1');
			let skippedHiddenLayers: boolean | undefined;
			const pasted = {
				...node('pasted', {}),
				get children() {
					skippedHiddenLayers = mockFigma.skipInvisibleInstanceChildren;
					return [];
				},
			};
			// A search is running, which skips hidden layers.
			const releaseSearch = acquireTraversalMode('fast');

			emitChange({ documentChanges: [{ type: 'CREATE', node: pasted }] });

			expect(skippedHiddenLayers).toBe(false);
			expect(mockFigma.skipInvisibleInstanceChildren).toBe(true);
			releaseSearch();
		});
	});

	test('counts variables used only in Motion as used', async () => {
		const animated = {
			...node('animated', {}),
			animationStyles: [
				{
					type: 'FIGMA',
					id: 'a1',
					styleId: 'fade',
					name: 'Fade',
					props: { easing: ALIAS('ease-out') },
				},
			],
			manualKeyframeTracks: {
				OPACITY: {
					id: 't1',
					keyframes: [
						{
							id: 'k1',
							timelinePosition: 0,
							easing: ALIAS('ease-in'),
							value: { type: 'FLOAT', value: 1 },
						},
					],
				},
			},
			animations: {
				fills: { 0: { tracks: [{ keyframes: [{ easing: ALIAS('spring') }] }] } },
			},
		};
		const { mockFigma } = setupFigma({
			variables: [
				variable('ease-out', NAVY),
				variable('ease-in', NAVY),
				variable('spring', NAVY),
				variable('bounce', NAVY),
				variable('old-bg', NAVY),
			],
			pages: [{ name: 'Page 1', children: [animated] }],
		});
		Object.assign(mockFigma, {
			getLocalCustomAnimationStylesAsync: vi.fn(async () => [
				{
					type: 'CUSTOM_ANIMATION',
					animationEntries: [
						{
							type: 'FIGMA',
							id: 'e1',
							styleId: 'pop',
							name: 'Pop',
							props: { easing: ALIAS('bounce') },
						},
					],
				},
			]),
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-bg']);
	});

	test('counts variables nested deeper than six levels as used', async () => {
		const deep = {
			...node('deep', {}),
			effects: [
				{
					type: 'SHADER',
					properties: { a: { b: { c: { d: { e: ALIAS('deep-var') } } } } },
				},
			],
		};
		setupFigma({
			variables: [variable('deep-var', NAVY), variable('old-bg', NAVY)],
			pages: [{ name: 'Page 1', children: [deep] }],
		});

		await scanner.scan('scan-1');

		expect(unusedIds()).toEqual(['old-bg']);
	});

	describe('deleteVariables', () => {
		function groupFixture() {
			const vars = [
				variable('brand-bg', NAVY),
				variable('button-bg', ALIAS('brand-bg')),
				variable('card-bg', ALIAS('brand-bg')),
				variable('in-use', NAVY),
			];
			const figmaMock = setupFigma({
				variables: vars,
				pages: [
					{ name: 'Page 1', children: [node('frame', { fills: [ALIAS('in-use')] })] },
				],
			});
			return { vars, ...figmaMock };
		}

		test('saves a version, then deletes the variable with everything that points to it', async () => {
			const { vars, mockFigma } = groupFixture();
			await scanner.scan('scan-1');

			const result = await scanner.deleteVariables(['brand-bg']);

			expect(result.versionSaved).toBe(true);
			expect([...result.deletedIds].sort()).toEqual(['brand-bg', 'button-bg', 'card-bg']);
			expect(mockFigma.saveVersionHistoryAsync).toHaveBeenCalledBefore(vars[0].remove);
			// The variables pointing to brand-bg go first, so nothing is left dangling.
			expect(result.deletedIds[result.deletedIds.length - 1]).toBe('brand-bg');
			expect(vars[3].remove).not.toHaveBeenCalled();
			expect(mockFigma.commitUndo).toHaveBeenCalled();
		});

		test('never deletes a variable that is used', async () => {
			const { vars } = groupFixture();
			await scanner.scan('scan-1');

			const result = await scanner.deleteVariables(['in-use']);

			expect(result.deletedIds).toEqual([]);
			expect(vars[3].remove).not.toHaveBeenCalled();
		});

		test('checks again before deleting: a variable that became used is kept', async () => {
			const { vars } = groupFixture();
			await scanner.scan('scan-1');
			// Someone points in-use at button-bg after the scan.
			vars[3].valuesByMode = { m: ALIAS('button-bg') };

			const result = await scanner.deleteVariables(['button-bg']);

			expect(result.deletedIds).toEqual([]);
			expect(vars[1].remove).not.toHaveBeenCalled();
		});

		test('refuses to delete when the file started using it since the scan', async () => {
			const { emitChange } = groupFixture();
			await scanner.scan('scan-1');
			emitChange({
				documentChanges: [
					{ type: 'CREATE', node: node('banner', { fills: [ALIAS('brand-bg')] }) },
				],
			});

			await expect(scanner.deleteVariables(['brand-bg'])).rejects.toThrow(
				'Rescan before deleting',
			);
		});

		test('deletes nothing when the version cannot be saved', async () => {
			const { vars, mockFigma } = groupFixture();
			await scanner.scan('scan-1');
			mockFigma.saveVersionHistoryAsync.mockRejectedValue(new Error('no access'));

			await expect(scanner.deleteVariables(['brand-bg'])).rejects.toThrow(
				"Couldn't save a version",
			);
			expect(vars[0].remove).not.toHaveBeenCalled();
		});
	});
});
