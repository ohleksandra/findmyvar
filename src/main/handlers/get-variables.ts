import { RpcResponse } from '../../shared/rpc-types';

export async function getVariablesHandler(): Promise<RpcResponse<'get-variables'>> {
	const variablesFromFigma = await figma.variables.getLocalVariablesAsync();

	// Map Figma variable data to local variable format
	const localVariables = variablesFromFigma.map((variable) => ({
		id: variable.id,
		name: variable.name,
		resolvedType: variable.resolvedType,
	}));

	return { variables: localVariables };
}
