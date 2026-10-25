import { describe, expect, test } from 'vitest';
import {
	findUnusedVariables,
	type GraphCollection,
	type GraphVariable,
} from '../src/main/services/variable-graph';

const ALIAS = (id: string) => ({ type: 'VARIABLE_ALIAS', id });
const RED = { r: 0.886, g: 0.294, b: 0.29, a: 1 };
const NAVY = { r: 0.047, g: 0.267, b: 0.486, a: 1 };
const SKY = { r: 0.522, g: 0.718, b: 0.922, a: 1 };

const primitives: GraphCollection = {
	id: 'c-prim',
	name: 'Primitives',
	modes: [{ modeId: 'p', name: 'Value' }],
	defaultModeId: 'p',
};
const semantic: GraphCollection = {
	id: 'c-sem',
	name: 'Semantic',
	modes: [
		{ modeId: 'light', name: 'Light' },
		{ modeId: 'dark', name: 'Dark' },
	],
	defaultModeId: 'light',
};

function variable(
	id: string,
	collection: GraphCollection,
	values: Record<string, unknown>,
	resolvedType: GraphVariable['resolvedType'] = 'COLOR',
): GraphVariable {
	return {
		id,
		name: id,
		resolvedType,
		variableCollectionId: collection.id,
		valuesByMode: values,
	};
}

function fixture() {
	return [
		variable('brand/900', primitives, { p: NAVY }),
		variable('brand/300', primitives, { p: SKY }),
		variable('red/500', primitives, { p: RED }),
		variable('brand-bg', semantic, { light: ALIAS('brand/900'), dark: ALIAS('brand/300') }),
		variable('button-bg', semantic, { light: ALIAS('brand-bg'), dark: ALIAS('brand-bg') }),
		variable('card-bg', semantic, { light: ALIAS('brand-bg'), dark: ALIAS('brand-bg') }),
		variable('danger', semantic, { light: ALIAS('red/500'), dark: ALIAS('red/500') }),
	];
}

const ids = (list: { id: string }[]) => list.map((v) => v.id).sort();

describe('findUnusedVariables', () => {
	test('a group nobody applies is unused, with the variables that point to it as children', () => {
		const unused = findUnusedVariables(fixture(), [primitives, semantic], new Set(['danger']));
		const byId = new Map(unused.map((v) => [v.id, v]));

		expect(ids(unused)).toEqual(['brand-bg', 'brand/300', 'brand/900', 'button-bg', 'card-bg']);
		expect(byId.get('button-bg')!.parentId).toBe('brand-bg');
		expect(byId.get('card-bg')!.parentId).toBe('brand-bg');
		// Palette values are listed apart, so the group starts at brand-bg.
		expect(byId.get('brand-bg')!.parentId).toBeNull();
		expect(
			byId
				.get('brand-bg')!
				.usedBy.map((u) => u.id)
				.sort(),
		).toEqual(['button-bg', 'card-bg']);
		// Deleting brand/900 would still have to take brand-bg with it.
		expect(byId.get('brand/900')!.usedBy.map((u) => u.id)).toEqual(['brand-bg']);
	});

	test('a variable used through an alias is not unused', () => {
		const unused = findUnusedVariables(fixture(), [primitives, semantic], new Set(['danger']));
		expect(ids(unused)).not.toContain('red/500');
	});

	test('if one variable that points to a group is applied, the group stays', () => {
		const unused = findUnusedVariables(
			fixture(),
			[primitives, semantic],
			new Set(['danger', 'button-bg']),
		);
		expect(ids(unused)).toEqual(['card-bg']);
		expect(unused[0].parentId).toBeNull();
	});

	test('a value used only in one mode still counts as used', () => {
		const vars = [
			variable('blue/500', primitives, { p: NAVY }),
			variable('blue/600', primitives, { p: SKY }),
			variable('button', semantic, { light: ALIAS('blue/500'), dark: ALIAS('blue/600') }),
		];
		const unused = findUnusedVariables(vars, [primitives, semantic], new Set(['button']));
		expect(unused).toEqual([]);
	});

	test('aliases set as overrides in an extended collection count as used', () => {
		const extended: GraphCollection = {
			id: 'c-ext',
			name: 'Brand B',
			modes: [{ modeId: 'b', name: 'Light' }],
			defaultModeId: 'b',
			isExtension: true,
			variableOverrides: { button: { b: ALIAS('red/500') } },
		};
		const vars = [
			variable('blue/500', primitives, { p: NAVY }),
			variable('red/500', primitives, { p: RED }),
			variable('button', semantic, { light: ALIAS('blue/500'), dark: ALIAS('blue/500') }),
		];
		const unused = findUnusedVariables(
			vars,
			[primitives, semantic, extended],
			new Set(['button']),
		);
		expect(unused).toEqual([]);
	});

	test('marks collections that hold raw values other collections point to as palette', () => {
		const custom = { ...primitives, name: 'Colours' };
		const vars = fixture().map((v) =>
			v.variableCollectionId === primitives.id
				? { ...v, variableCollectionId: custom.id }
				: v,
		);
		const unused = findUnusedVariables(vars, [custom, semantic], new Set(['danger']));
		const byId = new Map(unused.map((v) => [v.id, v]));

		expect(byId.get('brand/900')!.isPalette).toBe(true);
		expect(byId.get('brand-bg')!.isPalette).toBe(false);
	});

	test('a collection of raw values that nothing points to is not a palette', () => {
		const content: GraphCollection = { ...primitives, id: 'c-content', name: 'Content' };
		const vars = [variable('copy/promo', content, { p: 'Save 20%' }, 'STRING')];
		const [promo] = findUnusedVariables(vars, [content], new Set());
		expect(promo.isPalette).toBe(false);
		expect(promo.chains).toEqual([
			{
				modes: ['Value'],
				allModes: true,
				steps: [{ name: 'copy/promo', isPalette: false }],
				value: '"Save 20%"',
				color: null,
				opacity: null,
			},
		]);
	});

	test('builds the chain to the raw value for each mode', () => {
		const unused = findUnusedVariables(fixture(), [primitives, semantic], new Set(['danger']));
		const button = unused.find((v) => v.id === 'button-bg')!;

		expect(button.chains).toHaveLength(2);
		expect(button.chains[0]).toMatchObject({
			modes: ['Light'],
			allModes: false,
			value: '#0C447C',
			color: '#0C447C',
		});
		expect(button.chains[0].steps.map((s) => s.name)).toEqual([
			'button-bg',
			'brand-bg',
			'brand/900',
		]);
		expect(button.chains[0].steps[2].isPalette).toBe(true);
		expect(button.chains[1]).toMatchObject({ modes: ['Dark'], value: '#85B7EB' });
	});

	test('merges modes that resolve the same way', () => {
		const vars = [
			variable('gray/300', primitives, { p: SKY }),
			variable('divider', semantic, { light: ALIAS('gray/300'), dark: ALIAS('gray/300') }),
		];
		const [, divider] = findUnusedVariables(vars, [primitives, semantic], new Set());
		expect(divider.chains).toHaveLength(1);
		expect(divider.chains[0]).toMatchObject({ modes: ['Light', 'Dark'], allModes: true });
	});

	test('reports an alias to a variable that no longer exists', () => {
		const vars = [
			variable('ghost-bg', semantic, { light: ALIAS('gone'), dark: ALIAS('gone') }),
		];
		const [ghost] = findUnusedVariables(vars, [semantic], new Set());
		expect(ghost.chains[0].value).toBe('Missing variable');
	});

	test('reports opacity separately from the hex value', () => {
		const vars = [variable('overlay', primitives, { p: { r: 0, g: 0, b: 0, a: 0.5 } })];
		const [overlay] = findUnusedVariables(vars, [primitives], new Set());
		expect(overlay.chains[0]).toMatchObject({
			value: '#000000',
			opacity: 50,
			color: '#00000080',
		});
	});
});
