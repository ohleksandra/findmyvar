import type {
	UnusedVariable,
	VariableChain,
	VariableChainStep,
	VariableResolvedType,
} from '../../shared/rpc-types';
import { collectVariableIds, isAlias } from './binding-extractor';

/** The subset of a Figma `Variable` the analysis needs, so it can run without Figma. */
export interface GraphVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedType;
	variableCollectionId: string;
	valuesByMode: Record<string, unknown>;
}

/** The subset of a Figma `VariableCollection` (or extended collection) the analysis needs. */
export interface GraphCollection {
	id: string;
	name: string;
	modes: { modeId: string; name: string }[];
	defaultModeId: string;
	isExtension?: boolean;
	variableOverrides?: Record<string, Record<string, unknown>>;
}

const PALETTE_NAME = /primitive|palette|core|base|foundation|global/i;
const PALETTE_RAW_SHARE = 0.8;
const MAX_CHAIN_LENGTH = 10;
const MAX_STRING_LENGTH = 40;

function buildEdges(
	variables: GraphVariable[],
	collections: GraphCollection[],
): Map<string, Set<string>> {
	const edges = new Map<string, Set<string>>();
	const add = (from: string, value: unknown) => {
		const targets = edges.get(from) ?? new Set<string>();
		collectVariableIds(value, targets);
		edges.set(from, targets);
	};

	for (const variable of variables) {
		add(variable.id, variable.valuesByMode);
	}
	// Extended collections can override a value with an alias, which also counts as "points to".
	for (const collection of collections) {
		for (const [variableId, values] of Object.entries(collection.variableOverrides ?? {})) {
			add(variableId, values);
		}
	}
	return edges;
}

function findUsed(directlyUsedIds: Set<string>, edges: Map<string, Set<string>>): Set<string> {
	const used = new Set<string>();
	const stack = Array.from(directlyUsedIds);
	while (stack.length > 0) {
		const id = stack.pop()!;
		if (used.has(id)) continue;
		used.add(id);
		edges.get(id)?.forEach((target) => stack.push(target));
	}
	return used;
}

/**
 * A collection counts as a palette (primitives) when its name says so, or when it mostly holds
 * raw values and other collections point into it.
 */
function findPaletteCollections(
	variables: GraphVariable[],
	collections: GraphCollection[],
	edges: Map<string, Set<string>>,
): Set<string> {
	const collectionOf = new Map(variables.map((v) => [v.id, v.variableCollectionId]));
	const referencedFromOutside = new Set<string>();
	edges.forEach((targets, from) => {
		targets.forEach((target) => {
			const targetCollection = collectionOf.get(target);
			if (targetCollection && targetCollection !== collectionOf.get(from)) {
				referencedFromOutside.add(targetCollection);
			}
		});
	});

	const palette = new Set<string>();
	for (const collection of collections) {
		if (collection.isExtension) continue;
		const members = variables.filter((v) => v.variableCollectionId === collection.id);
		if (members.length === 0) continue;

		const rawCount = members.filter((v) => (edges.get(v.id)?.size ?? 0) === 0).length;
		const mostlyRaw = rawCount / members.length >= PALETTE_RAW_SHARE;

		if (
			PALETTE_NAME.test(collection.name) ||
			(mostlyRaw && referencedFromOutside.has(collection.id))
		) {
			palette.add(collection.id);
		}
	}
	return palette;
}

function toHex(channel: number): string {
	return Math.round(channel * 255)
		.toString(16)
		.padStart(2, '0')
		.toUpperCase();
}

interface DisplayValue {
	text: string;
	color: string | null;
	opacity: number | null;
}

function formatValue(value: unknown, type: VariableResolvedType): DisplayValue {
	if (type === 'COLOR' && value && typeof value === 'object' && 'r' in value) {
		const { r, g, b, a } = value as RGBA;
		const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
		const alpha = a === undefined ? 1 : a;
		return {
			text: hex,
			color: alpha < 1 ? `${hex}${toHex(alpha)}` : hex,
			opacity: Math.round(alpha * 100),
		};
	}
	if (typeof value === 'number') {
		return { text: String(Math.round(value * 100) / 100), color: null, opacity: null };
	}
	if (typeof value === 'string') {
		const short =
			value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
		return { text: `"${short}"`, color: null, opacity: null };
	}
	if (typeof value === 'boolean') {
		return { text: String(value), color: null, opacity: null };
	}
	return { text: type.toLowerCase(), color: null, opacity: null };
}

function aliasTarget(value: unknown): string | null {
	if (isAlias(value)) return value.id;
	// Composed colours keep the alias in `color`.
	if (
		value &&
		typeof value === 'object' &&
		'color' in value &&
		isAlias((value as { color: unknown }).color)
	) {
		return (value as { color: VariableAlias }).color.id;
	}
	return null;
}

function pickMode(collection: GraphCollection | undefined, modeName: string): string | undefined {
	if (!collection) return undefined;
	const sameName = collection.modes.find((m) => m.name.toLowerCase() === modeName.toLowerCase());
	return sameName?.modeId ?? collection.defaultModeId;
}

function valueFor(
	variable: GraphVariable,
	modeId: string | undefined,
	collection?: GraphCollection,
): unknown {
	if (modeId && modeId in variable.valuesByMode) return variable.valuesByMode[modeId];
	if (collection && collection.defaultModeId in variable.valuesByMode) {
		return variable.valuesByMode[collection.defaultModeId];
	}
	return Object.values(variable.valuesByMode)[0];
}

function buildChains(
	variable: GraphVariable,
	byId: Map<string, GraphVariable>,
	collectionsById: Map<string, GraphCollection>,
	palette: Set<string>,
): VariableChain[] {
	const ownCollection = collectionsById.get(variable.variableCollectionId);
	const modes =
		ownCollection?.modes ??
		Object.keys(variable.valuesByMode).map((modeId) => ({ modeId, name: modeId }));

	const merged = new Map<string, VariableChain>();

	for (const mode of modes) {
		const steps: VariableChainStep[] = [];
		let current: GraphVariable = variable;
		let modeId: string | undefined = mode.modeId;
		let display: DisplayValue = { text: '', color: null, opacity: null };

		for (let i = 0; i < MAX_CHAIN_LENGTH; i++) {
			const collection = collectionsById.get(current.variableCollectionId);
			steps.push({
				name: current.name,
				isPalette: palette.has(current.variableCollectionId),
			});

			const value = valueFor(current, modeId, collection);
			const targetId = aliasTarget(value);
			if (!targetId) {
				display = formatValue(value, current.resolvedType);
				break;
			}

			const target = byId.get(targetId);
			if (!target) {
				display = { text: 'Missing variable', color: null, opacity: null };
				break;
			}
			modeId = pickMode(collectionsById.get(target.variableCollectionId), mode.name);
			current = target;
		}

		const key = `${steps.map((s) => s.name).join('>')}=${display.text}`;
		const existing = merged.get(key);
		if (existing) {
			existing.modes.push(mode.name);
		} else {
			merged.set(key, {
				modes: [mode.name],
				allModes: false,
				steps,
				value: display.text,
				color: display.color,
				opacity: display.opacity,
			});
		}
	}

	const chains = Array.from(merged.values());
	for (const chain of chains) {
		chain.allModes = chain.modes.length === modes.length;
	}
	return chains;
}

/**
 * The first unused variable this one points to, so unused groups can be shown as a tree. Palette
 * values are never a parent of other variables: they are kept and listed apart.
 */
function findParent(
	variable: GraphVariable,
	edges: Map<string, Set<string>>,
	unusedIds: Set<string>,
	isPalette: (id: string) => boolean,
): string | null {
	const targets = Array.from(edges.get(variable.id) ?? []);
	return (
		targets.find(
			(target) =>
				target !== variable.id &&
				unusedIds.has(target) &&
				(!isPalette(target) || isPalette(variable.id)),
		) ?? null
	);
}

function breakCycles(unused: UnusedVariable[]): void {
	const byId = new Map(unused.map((v) => [v.id, v]));
	for (const variable of unused) {
		const seen = new Set<string>([variable.id]);
		let parentId = variable.parentId;
		while (parentId) {
			if (seen.has(parentId)) {
				variable.parentId = null;
				break;
			}
			seen.add(parentId);
			parentId = byId.get(parentId)?.parentId ?? null;
		}
	}
}

/**
 * Works out which local variables nothing uses. A variable is used when it is bound to a layer or
 * style (`directlyUsedIds`), or when a used variable points to it in any mode.
 */
export function findUnusedVariables(
	variables: GraphVariable[],
	collections: GraphCollection[],
	directlyUsedIds: Set<string>,
): UnusedVariable[] {
	const byId = new Map(variables.map((v) => [v.id, v]));
	const collectionsById = new Map(collections.map((c) => [c.id, c]));
	const edges = buildEdges(variables, collections);
	const used = findUsed(directlyUsedIds, edges);
	const palette = findPaletteCollections(variables, collections, edges);

	const unusedVariables = variables.filter((v) => !used.has(v.id));
	const unusedIds = new Set(unusedVariables.map((v) => v.id));
	const isPalette = (id: string) => palette.has(byId.get(id)?.variableCollectionId ?? '');

	const usedBy = new Map<string, { id: string; name: string }[]>();
	for (const variable of unusedVariables) {
		edges.get(variable.id)?.forEach((target) => {
			if (target === variable.id || !unusedIds.has(target)) return;
			const list = usedBy.get(target) ?? [];
			list.push({ id: variable.id, name: variable.name });
			usedBy.set(target, list);
		});
	}

	const unused = unusedVariables.map((variable) => ({
		id: variable.id,
		name: variable.name,
		resolvedType: variable.resolvedType,
		collectionId: variable.variableCollectionId,
		collectionName: collectionsById.get(variable.variableCollectionId)?.name ?? 'Other',
		isPalette: isPalette(variable.id),
		parentId: findParent(variable, edges, unusedIds, isPalette),
		usedBy: usedBy.get(variable.id) ?? [],
		chains: buildChains(variable, byId, collectionsById, palette),
	}));

	breakCycles(unused);
	return unused;
}
