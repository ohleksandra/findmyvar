import type { Variable } from '../../shared/rpc-types';
import type { HandlerMap } from './types';
import { logger } from '../../shared/logger';

async function getVariablesHandler(): Promise<{ variables: Variable[] }> {
	const variablesFromFigma = await figma.variables.getLocalVariablesAsync();

	logger.log(`[get-variables] Found ${variablesFromFigma.length} variables`);

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

export function getVariablesHandlers(): HandlerMap {
	return { 'get-variables': getVariablesHandler };
}
