import type { Variable } from '../../shared/rpc-types';
import type { HandlerMap } from './types';

async function getVariablesHandler(): Promise<{ variables: Variable[] }> {
	const [variablesFromFigma, collections] = await Promise.all([
		figma.variables.getLocalVariablesAsync(),
		figma.variables.getLocalVariableCollectionsAsync(),
	]);
	const collectionNames = new Map(collections.map((c) => [c.id, c.name]));

	const localVariables = variablesFromFigma.map((variable) => ({
		id: variable.id,
		name: variable.name,
		resolvedType: variable.resolvedType,
		variableCollectionId: variable.variableCollectionId,
		collectionName: collectionNames.get(variable.variableCollectionId),
		hiddenFromPublishing: variable.hiddenFromPublishing,
		remote: variable.remote,
	}));

	return { variables: localVariables };
}

export function getVariablesHandlers(): HandlerMap {
	return { 'get-variables': getVariablesHandler };
}
