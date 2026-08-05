import type { Variable } from '../../shared/rpc-types';

export async function getVariablesHandler(): Promise<{ variables: Variable[] }> {
	const variablesFromFigma = await figma.variables.getLocalVariablesAsync();

	const localVariables = variablesFromFigma.map((variable) => ({
		id: variable.id,
		name: variable.name,
		resolvedType: variable.resolvedType,
		variableCollectionId: variable.variableCollectionId,
		hiddenFromPublishing: variable.hiddenFromPublishing,
		remote: variable.remote,
	}));

	return { variables: localVariables };
}
