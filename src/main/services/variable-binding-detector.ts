export class VariableBindingDetector {
	private static SCALAR_PROPS = [
		'width',
		'height',
		'minWidth',
		'maxWidth',
		'minHeight',
		'maxHeight',
		'paddingLeft',
		'paddingRight',
		'paddingTop',
		'paddingBottom',
		'itemSpacing',
		'counterAxisSpacing',
		'topLeftRadius',
		'topRightRadius',
		'bottomLeftRadius',
		'bottomRightRadius',
		'cornerRadius',
		'strokeWeight',
		'strokeTopWeight',
		'strokeRightWeight',
		'strokeBottomWeight',
		'strokeLeftWeight',
		'opacity',
		'fontSize',
		'lineHeight',
		'letterSpacing',
		'paragraphSpacing',
		'paragraphIndent',
	] as const;

	private static ARRAY_PROPS = ['fills', 'strokes', 'effects', 'layoutGrids'] as const;

	findBindingsForVariable(node: SceneNode, variableId: string): string[] {
		const boundVars = this.getBoundVariables(node);
		if (!boundVars) return [];

		const fields: string[] = [];

		// Scalar properties
		for (const prop of VariableBindingDetector.SCALAR_PROPS) {
			if (this.isAliasWithId(boundVars[prop], variableId)) {
				fields.push(prop);
			}
		}

		// Array properties
		for (const prop of VariableBindingDetector.ARRAY_PROPS) {
			const arr = boundVars[prop];
			if (!Array.isArray(arr)) continue;

			arr.forEach((binding, i) => {
				if (this.isAliasWithId(binding, variableId)) {
					fields.push(`${prop}[${i}]`);
				}
				// Nested color
				if (this.isAliasWithId(binding?.color, variableId)) {
					fields.push(`${prop}[${i}].color`);
				}
			});
		}

		// Component properties
		if (node.type === 'INSTANCE' && boundVars.componentProperties) {
			for (const [name, binding] of Object.entries(boundVars.componentProperties)) {
				if (this.isAliasWithId(binding, variableId)) {
					fields.push(`componentProperties.${name}`);
				}
			}
		}

		// Text range fills
		if (node.type === 'TEXT' && Array.isArray(boundVars.textRangeFills)) {
			boundVars.textRangeFills.forEach((binding: unknown, i: number) => {
				if (this.isAliasWithId(binding, variableId)) {
					fields.push(`textRangeFills[${i}]`);
				}
			});
		}

		return fields;
	}

	private getBoundVariables(node: SceneNode): Record<string, any> | null {
		return 'boundVariables' in node ? (node.boundVariables as Record<string, any>) : null;
	}

	private isAliasWithId(value: unknown, variableId: string): boolean {
		return (
			value !== null &&
			typeof value === 'object' &&
			(value as any).type === 'VARIABLE_ALIAS' &&
			(value as any).id === variableId
		);
	}
}
