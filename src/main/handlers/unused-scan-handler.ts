import type { PluginProcedures } from '../../shared/rpc-types';
import type { HandlerMap, HandlerDeps } from './types';

export function unusedScanHandlers(deps: HandlerDeps): HandlerMap {
	const { unusedVariableScanner } = deps;

	type StartPayload = PluginProcedures['unusedScan.start']['request'];
	type DeletePayload = PluginProcedures['unusedScan.delete']['request'];

	return {
		'unusedScan.start': (payload: StartPayload) => {
			void unusedVariableScanner.scan(payload.scanId);
			return { started: true };
		},

		'unusedScan.cancel': async () => {
			unusedVariableScanner.cancelScan();
			return { cancelled: true };
		},

		'unusedScan.delete': (payload: DeletePayload) =>
			unusedVariableScanner.deleteVariables(payload.ids),
	};
}
