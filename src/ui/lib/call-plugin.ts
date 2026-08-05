import { createRpcClient, FigmaUiTransport } from 'figma-plugin-rpc';
import type { PluginProcedures, PluginNotifications } from '../../shared/rpc-types';

export const rpcClient = createRpcClient<PluginProcedures, PluginNotifications>(
	new FigmaUiTransport(),
);

export function callPlugin<T extends keyof PluginProcedures>(
	procedure: T,
	...args: PluginProcedures[T]['request'] extends void
		? [payload?: void, options?: { timeout?: number }]
		: [payload: PluginProcedures[T]['request'], options?: { timeout?: number }]
): Promise<PluginProcedures[T]['response']> {
	return rpcClient.call(procedure, ...(args as [never, { timeout?: number }?]));
}
