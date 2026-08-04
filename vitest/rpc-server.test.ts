import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mockPostMessage = vi.fn();

vi.mock('../src/shared/logger', () => ({
	logger: {
		log: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	formatDuration: (ms: number) => `${ms}ms`,
}));

describe('RpcServer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();

		vi.stubGlobal('figma', {
			ui: {
				postMessage: mockPostMessage,
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('sends error response when handler throws', async () => {
		const { rpcServer } = await import('../src/main/lib/rpc-server');

		rpcServer.registerHandler('get-variables', () => {
			throw new Error('Handler error');
		});

		const message = {
			__rpc: true as const,
			id: 'test-id',
			procedure: 'get-variables' as const,
			payload: undefined,
		};

		await rpcServer.processMessage(message);

		expect(mockPostMessage).toHaveBeenCalledWith({
			__rpc: true,
			id: 'test-id',
			procedure: 'get-variables',
			error: 'Handler error',
		});
	});

	test('sends error for unknown procedure', async () => {
		const { rpcServer } = await import('../src/main/lib/rpc-server');

		const message = {
			__rpc: true as const,
			id: 'test-id',
			procedure: 'unknown-procedure' as const,
			payload: undefined,
		};

		await rpcServer.processMessage(message);

		expect(mockPostMessage).toHaveBeenCalledWith({
			__rpc: true,
			id: 'test-id',
			procedure: 'unknown-procedure',
			error: 'Unknown procedure: "unknown-procedure"',
		});
	});

	test('sends response for successful handler', async () => {
		const { rpcServer } = await import('../src/main/lib/rpc-server');

		rpcServer.registerHandler('get-variables', () => {
			return { variables: [] };
		});

		const message = {
			__rpc: true as const,
			id: 'test-id',
			procedure: 'get-variables' as const,
			payload: undefined,
		};

		await rpcServer.processMessage(message);

		expect(mockPostMessage).toHaveBeenCalledWith({
			__rpc: true,
			id: 'test-id',
			procedure: 'get-variables',
			response: { variables: [] },
		});
	});

	test('returns false for non-RPC messages', async () => {
		const { rpcServer } = await import('../src/main/lib/rpc-server');

		const result = await rpcServer.processMessage({ foo: 'bar' });
		expect(result).toBe(false);
	});

	test('returns true for RPC messages', async () => {
		const { rpcServer } = await import('../src/main/lib/rpc-server');

		rpcServer.registerHandler('get-variables', () => ({ variables: [] }));

		const message = {
			__rpc: true as const,
			id: 'test-id',
			procedure: 'get-variables' as const,
			payload: undefined,
		};

		const result = await rpcServer.processMessage(message);
		expect(result).toBe(true);
	});

	test('posts notification message', async () => {
		const { rpcServer } = await import('../src/main/lib/rpc-server');

		rpcServer.notify('variableSearch.results', {
			searchId: 'search-1',
			results: [],
			isComplete: true,
		});

		expect(mockPostMessage).toHaveBeenCalledWith({
			__rpcNotification: true,
			notification: 'variableSearch.results',
			payload: {
				searchId: 'search-1',
				results: [],
				isComplete: true,
			},
		});
	});
});
