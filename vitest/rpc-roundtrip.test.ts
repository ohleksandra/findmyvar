import { describe, expect, test, vi } from 'vitest';
import { createRpcClient, createRpcServer, type RpcTransport } from 'figma-plugin-rpc';
import type { PluginNotifications, PluginProcedures } from '../src/shared/rpc-types';
import { registerAllHandlers } from '../src/main/handlers';

// Temporary diagnostic: round-trip get-variables through real v2 client+server.
function loopbackPair() {
	const a = new Set<(msg: unknown) => void>();
	const b = new Set<(msg: unknown) => void>();
	const mk = (
		self: Set<(msg: unknown) => void>,
		peer: Set<(msg: unknown) => void>,
	): RpcTransport => ({
		send: (message: unknown) => {
			for (const h of peer) h(message);
		},
		onMessage: (handler: (msg: unknown) => void) => {
			self.add(handler);
			return () => {
				self.delete(handler);
			};
		},
	});
	return { ui: mk(a, b), main: mk(b, a) };
}

describe('rpc round-trip (diagnostic)', () => {
	test('get-variables returns mapped variables including EASING', async () => {
		vi.stubGlobal('figma', {
			variables: {
				getLocalVariablesAsync: async () => [
					{
						id: 'v1',
						name: 'color/primary',
						resolvedType: 'COLOR',
						variableCollectionId: 'c1',
						hiddenFromPublishing: false,
						remote: false,
					},
					{
						id: 'v2',
						name: 'motion/ease',
						resolvedType: 'EASING',
						variableCollectionId: 'c1',
						hiddenFromPublishing: false,
						remote: false,
					},
				],
			},
			ui: { postMessage: () => {}, on: () => {}, off: () => {} },
		});

		const { ui, main } = loopbackPair();
		const server = createRpcServer<PluginProcedures, PluginNotifications>(main);
		registerAllHandlers(server, {
			variableSearchService: {} as never,
		});
		server.start();

		const client = createRpcClient<PluginProcedures, PluginNotifications>(ui);
		client.start();

		const res = await client.call('get-variables');
		expect(res.variables).toHaveLength(2);
		expect(res.variables[1].resolvedType).toBe('EASING');

		client.stop();
		server.stop();
		vi.unstubAllGlobals();
	});
});
