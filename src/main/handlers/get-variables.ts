import { RpcResponse } from '../../shared/rpc-types';

export async function getVariablesHandler(): Promise<RpcResponse<'get-variables'>> {
	const variablesFromFigma = await figma.variables.getLocalVariablesAsync();

	const localVariables = variablesFromFigma.map((variable) => ({
		id: variable.id,
		name: variable.name,
		resolvedType: variable.resolvedType,
		variableCollectionId: variable.variableCollectionId,
		hiddenFromPubslishing: variable.hiddenFromPublishing,
		remote: variable.remote,
	}));

	return { variables: localVariables };
}
