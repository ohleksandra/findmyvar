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

export { extractBindings };
