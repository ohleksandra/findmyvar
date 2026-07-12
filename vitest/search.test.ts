import { describe, expect, test } from 'vitest';
import { MatchType, searchVariables } from '../src/ui/lib/search';
import type { Variable } from '../src/shared/rpc-types';

const make = (name: string, overrides: Partial<Variable> = {}): Variable => ({
	id: `id-${name}`,
	name,
	resolvedType: 'COLOR',
	hiddenFromPublishing: false,
	...overrides,
});

describe('searchVariables', () => {
	test('returns no results for empty query', () => {
		const result = searchVariables([make('primary')], '');
		expect(result).toEqual([]);
	});

	test('returns no results for whitespace-only query', () => {
		const result = searchVariables([make('primary')], '   ');
		expect(result).toEqual([]);
	});

	test('ranks exact match first', () => {
		const variables = [make('color/primary'), make('color/primary-2')];
		const result = searchVariables(variables, 'color/primary');
		expect(result[0].variable.name).toBe('color/primary');
		expect(result[0].matchType).toBe(MatchType.EXACT);
	});

	test('ranks prefix match above word-boundary match', () => {
		const variables = [make('spacing-md'), make('text-spacing-md')];
		const result = searchVariables(variables, 'spacing');
		expect(result[0].variable.name).toBe('spacing-md');
		expect(result[0].matchType).toBe(MatchType.STARTS_WITH);
		expect(result[1].matchType).toBe(MatchType.WORD_BOUNDARY);
	});

	test('detects word boundary after separators (-_/. )', () => {
		const variables = [make('colors/primary'), make('colorsAccent'), make('prim-secondary')];
		const result = searchVariables(variables, 'primary');
		expect(result[0].variable.name).toBe('colors/primary');
		expect(result[0].matchType).toBe(MatchType.WORD_BOUNDARY);
		expect(result[0].matchIndex).toBe(7);
	});

	test('is case-insensitive', () => {
		const variables = [make('Color/Primary')];
		const result = searchVariables(variables, 'color');
		expect(result).toHaveLength(1);
		expect(result[0].matchType).toBe(MatchType.STARTS_WITH);
	});

	test('escapes regex special characters in user input', () => {
		const variables = [make('a.b')];
		const result = searchVariables(variables, 'a.b');
		expect(result).toHaveLength(1);
		expect(result[0].matchType).toBe(MatchType.EXACT);
	});

	test('breaks ties on equal match-type by name length, then alphabetically', () => {
		const variables = [make('a-primary'), make('bb-primary'), make('ccc-primary')];
		const result = searchVariables(variables, 'primary');
		expect(result.map((r) => r.variable.name)).toEqual([
			'a-primary',
			'bb-primary',
			'ccc-primary',
		]);
	});

	test('respects limit', () => {
		const variables = Array.from({ length: 10 }, (_, i) => make(`var-${i}`));
		const result = searchVariables(variables, 'var', 3);
		expect(result).toHaveLength(3);
	});

	test('returns no results when nothing matches', () => {
		const variables = [make('primary')];
		const result = searchVariables(variables, 'spacing');
		expect(result).toEqual([]);
	});
});
