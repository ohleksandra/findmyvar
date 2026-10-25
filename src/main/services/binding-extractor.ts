import { logger } from '../../shared/logger';

type BoundVariableValue =
	| VariableAlias
	| VariableAlias[]
	| VariableAlias[][]
	| { readonly [propertyName: string]: VariableAlias };

function isAlias(v: unknown): v is VariableAlias {
	return (
		typeof v === 'object' &&
		v !== null &&
		(v as VariableAlias).type === 'VARIABLE_ALIAS' &&
		typeof (v as VariableAlias).id === 'string'
	);
}

function extractBindings(node: SceneNode, targetVariableId: string): string[] | null {
	let fields: string[] | null = null;
	// Top-level fields (e.g. `fills`) where the variable already showed up in `node.boundVariables`.
	const reportedKeys = new Set<string>();

	const bv = 'boundVariables' in node ? node.boundVariables : null;
	const keys = bv ? Object.keys(bv) : [];

	for (const key of keys) {
		const binding = (bv as Record<string, BoundVariableValue | undefined>)[key];
		if (!binding) continue;

		if (Array.isArray(binding)) {
			for (let j = 0; j < binding.length; j++) {
				const item = binding[j];

				if (Array.isArray(item)) {
					for (let k = 0; k < item.length; k++) {
						if (isAlias(item[k]) && item[k].id === targetVariableId) {
							fields ??= [];
							fields.push(`${key}[${j}][${k}]`);
						}
					}
				} else if (isAlias(item) && item.id === targetVariableId) {
					fields ??= [];
					fields.push(`${key}[${j}]`);
				}
			}
		} else if (typeof binding === 'object' && !Array.isArray(binding)) {
			if (isAlias(binding)) {
				if (binding.id === targetVariableId) {
					fields ??= [];
					fields.push(key);
				}
			} else {
				for (const [propName, alias] of Object.entries(binding)) {
					if (isAlias(alias) && alias.id === targetVariableId) {
						fields ??= [];
						fields.push(`${key}.${propName}`);
					}
				}
			}
		}
	}

	if (fields) fields.forEach((field) => reportedKeys.add(topLevelKey(field)));

	let foundInMotion = false;
	forEachNestedBinding(node, (field, variableId) => {
		const key = topLevelKey(field);
		// A solid fill's colour is listed both in `node.boundVariables.fills` and on the paint itself.
		if (variableId !== targetVariableId || reportedKeys.has(key)) return;
		// `animations` repeats the keyframes of animation styles and manual tracks.
		if (key === 'animations' && foundInMotion) return;
		if (key === 'animationStyles' || key === 'manualKeyframeTracks') foundInMotion = true;
		fields ??= [];
		fields.push(field);
	});

	return fields;
}

const MOTION_KEYS = ['animationStyles', 'manualKeyframeTracks', 'animations'] as const;

function topLevelKey(field: string): string {
	return field.split(/[.[]/, 1)[0];
}

type BindingVisitor = (field: string, variableId: string) => void;

/**
 * Visits every alias inside `value`, passing a path like `fills[0].gradientStops[1].color`. There's
 * no depth limit: Figma returns plain data without cycles, and stopping early would make a variable
 * look unused.
 */
function walkAliases(value: unknown, path: string, visit: BindingVisitor): void {
	if (value === null || typeof value !== 'object') return;

	if (isAlias(value)) {
		visit(path, value.id);
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item, i) => walkAliases(item, `${path}[${i}]`, visit));
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		// `fills[0].color` reads better than `fills[0].boundVariables.color`.
		const childPath = key === 'boundVariables' ? path : `${path}.${key}`;
		walkAliases(child, childPath, visit);
	}
}

/** Only these nodes can read `componentPropertyDefinitions`. On a variant, the getter throws. */
function hasComponentPropertyDefinitions(node: SceneNode): boolean {
	return (
		node.type === 'COMPONENT_SET' ||
		(node.type === 'COMPONENT' && node.parent?.type !== 'COMPONENT_SET')
	);
}

/**
 * Visits the bindings Figma keeps outside `node.boundVariables`: on gradient stops, on effect and
 * layout grid fields, in Motion (easing and values of animation styles and keyframes), and on the
 * default values of component properties.
 */
function forEachNestedBinding(node: SceneNode, visit: BindingVisitor): void {
	const n = node as Partial<
		Record<
			'fills' | 'strokes' | 'effects' | 'layoutGrids' | (typeof MOTION_KEYS)[number],
			unknown
		>
	>;

	if ('fills' in node) {
		if (Array.isArray(n.fills)) {
			walkAliases(n.fills, 'fills', visit);
		} else if (node.type === 'TEXT') {
			// Text with several fills returns `figma.mixed`, so read each styled range instead.
			node.getStyledTextSegments(['fills']).forEach((segment, i) =>
				walkAliases(segment.fills, `textRangeFills[${i}]`, visit),
			);
		}
	}
	if ('strokes' in node) walkAliases(n.strokes, 'strokes', visit);
	if ('effects' in node) walkAliases(n.effects, 'effects', visit);
	if ('layoutGrids' in node) walkAliases(n.layoutGrids, 'layoutGrids', visit);
	for (const key of MOTION_KEYS) {
		if (key in node) walkAliases(n[key], key, visit);
	}

	if (hasComponentPropertyDefinitions(node)) {
		try {
			const definitions = (node as ComponentNode | ComponentSetNode)
				.componentPropertyDefinitions;
			for (const [name, definition] of Object.entries(definitions)) {
				walkAliases(
					definition.boundVariables,
					`componentPropertyDefinitions.${name}`,
					visit,
				);
			}
		} catch (error) {
			// A component set with conflicting variants throws here.
			logger.warn(`[Bindings] Can't read component properties of ${node.name}`, error);
		}
	}
}

/**
 * Adds every variable id referenced anywhere inside `value` (a node's boundVariables,
 * a style's paints/effects, etc.) to `out`. No depth limit, for the same reason as `walkAliases`.
 */
function collectVariableIds(value: unknown, out: Set<string>): void {
	if (value === null || typeof value !== 'object') return;

	if (isAlias(value)) {
		out.add(value.id);
		return;
	}

	const children = Array.isArray(value) ? value : Object.values(value);
	for (const child of children) {
		collectVariableIds(child, out);
	}
}

/**
 * Adds every variable a node's prototype interactions use: "Set variable" targets, and aliases in
 * values and conditions (e.g. "if isLoggedIn"). These variables aren't bound to the layer itself.
 */
function collectPrototypeVariableIds(value: unknown, out: Set<string>): void {
	if (value === null || typeof value !== 'object') return;

	if (isAlias(value)) {
		out.add(value.id);
		return;
	}

	const action = value as { type?: unknown; variableId?: unknown };
	if (action.type === 'SET_VARIABLE' && typeof action.variableId === 'string') {
		out.add(action.variableId);
	}

	const children = Array.isArray(value) ? value : Object.values(value);
	for (const child of children) {
		collectPrototypeVariableIds(child, out);
	}
}

export {
	extractBindings,
	forEachNestedBinding,
	collectVariableIds,
	collectPrototypeVariableIds,
	isAlias,
};
