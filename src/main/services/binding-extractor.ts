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
	if (!('boundVariables' in node)) return null;

	const bv = node.boundVariables;
	if (!bv) return null;

	let fields: string[] | null = null;
	const keys = Object.keys(bv);

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

	return fields;
}

const MAX_ALIAS_DEPTH = 6;

/**
 * Adds every variable id referenced anywhere inside `value` (a node's boundVariables,
 * a style's paints/effects, etc.) to `out`.
 */
function collectVariableIds(value: unknown, out: Set<string>, depth: number = 0): void {
	if (value === null || typeof value !== 'object' || depth > MAX_ALIAS_DEPTH) return;

	if (isAlias(value)) {
		out.add(value.id);
		return;
	}

	const children = Array.isArray(value) ? value : Object.values(value);
	for (const child of children) {
		collectVariableIds(child, out, depth + 1);
	}
}

// Conditionals nest actions inside blocks inside expressions, so prototype data runs deeper.
const MAX_PROTOTYPE_DEPTH = 24;

/**
 * Adds every variable a node's prototype interactions use: "Set variable" targets, and aliases in
 * values and conditions (e.g. "if isLoggedIn"). These variables aren't bound to the layer itself.
 */
function collectPrototypeVariableIds(value: unknown, out: Set<string>, depth: number = 0): void {
	if (value === null || typeof value !== 'object' || depth > MAX_PROTOTYPE_DEPTH) return;

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
		collectPrototypeVariableIds(child, out, depth + 1);
	}
}

export { extractBindings, collectVariableIds, collectPrototypeVariableIds, isAlias };
