import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mockPostMessage = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

vi.mock('../src/shared/logger', () => ({
	logger: {
		log: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	formatDuration: (ms: number) => `${ms}ms`,
}));

describe('RpcClient', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.useFakeTimers();

		vi.stubGlobal('parent', {
			postMessage: mockPostMessage,
		});

		vi.stubGlobal('window', {
			addEventListener: mockAddEventListener,
			removeEventListener: mockRemoveEventListener,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe('init', () => {
		test('adds message event listener', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();
			expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));
			rpcClient.destroy();
		});

		test('does not add listener twice', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();
			rpcClient.init();
			expect(mockAddEventListener).toHaveBeenCalledTimes(1);
			rpcClient.destroy();
		});
	});

	describe('call', () => {
		test('rejects if not initialized', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			await expect(rpcClient.call('get-variables')).rejects.toThrow(
				'RPC client not initialized',
			);
		});

		test('posts message to parent', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();
			const promise = rpcClient.call('get-variables');

			expect(mockPostMessage).toHaveBeenCalledWith(
				{
					pluginMessage: {
						__rpc: true,
						id: expect.any(String),
						procedure: 'get-variables',
						payload: undefined,
					},
				},
				'*',
			);

			promise.catch(() => {});
			rpcClient.destroy();
		});

		test('rejects on timeout', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();
			const promise = rpcClient.call('get-variables', undefined, { timeout: 1000 });

			const rejectionPromise = expect(promise).rejects.toThrow('timed out after 1000ms');

			await vi.advanceTimersByTimeAsync(1000);

			await rejectionPromise;
		});

		test('resolves on response', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();

			let messageId = '';
			mockPostMessage.mockImplementation((msg) => {
				messageId = msg.pluginMessage.id;
			});

			const promise = rpcClient.call('get-variables');

			const responseEvent = {
				data: {
					pluginMessage: {
						__rpc: true,
						id: messageId,
						procedure: 'get-variables',
						response: { variables: [] },
					},
				},
			};

			const messageHandler = mockAddEventListener.mock.calls[0][1];
			messageHandler(responseEvent);

			await expect(promise).resolves.toEqual({ variables: [] });
			rpcClient.destroy();
		});

		test('rejects on error response', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();

			let messageId = '';
			mockPostMessage.mockImplementation((msg) => {
				messageId = msg.pluginMessage.id;
			});

			const promise = rpcClient.call('get-variables');

			const responseEvent = {
				data: {
					pluginMessage: {
						__rpc: true,
						id: messageId,
						procedure: 'get-variables',
						error: 'Something went wrong',
					},
				},
			};

			const messageHandler = mockAddEventListener.mock.calls[0][1];
			messageHandler(responseEvent);

			await expect(promise).rejects.toThrow('Something went wrong');
			rpcClient.destroy();
		});
	});

	describe('on', () => {
		test('dispatches notifications to handlers', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();

			const handler = vi.fn();
			rpcClient.on('variableSearch.results', handler);

			const notificationEvent = {
				data: {
					pluginMessage: {
						__rpcNotification: true,
						notification: 'variableSearch.results',
						payload: {
							searchId: 'search-1',
							results: [],
							isComplete: true,
						},
					},
				},
			};

			const messageHandler = mockAddEventListener.mock.calls[0][1];
			messageHandler(notificationEvent);

			expect(handler).toHaveBeenCalledWith({
				searchId: 'search-1',
				results: [],
				isComplete: true,
			});
			rpcClient.destroy();
		});

		test('returns unsubscribe function', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();

			const handler = vi.fn();
			const unsubscribe = rpcClient.on('variableSearch.results', handler);

			unsubscribe();

			const notificationEvent = {
				data: {
					pluginMessage: {
						__rpcNotification: true,
						notification: 'variableSearch.results',
						payload: {
							searchId: 'search-1',
							results: [],
							isComplete: true,
						},
					},
				},
			};

			const messageHandler = mockAddEventListener.mock.calls[0][1];
			messageHandler(notificationEvent);

			expect(handler).not.toHaveBeenCalled();
			rpcClient.destroy();
		});
	});

	describe('destroy', () => {
		test('removes message event listener', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();
			rpcClient.destroy();

			expect(mockRemoveEventListener).toHaveBeenCalledWith('message', expect.any(Function));
		});

		test('rejects pending requests', async () => {
			const { rpcClient } = await import('../src/ui/lib/rpc-client');
			rpcClient.init();

			mockPostMessage.mockImplementation(() => {});
			const promise = rpcClient.call('get-variables');

			rpcClient.destroy();

			await expect(promise).rejects.toThrow('destroyed while');
		});
	});
});
