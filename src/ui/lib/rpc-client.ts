import {
	isRpcResponse,
	type RpcProcedure,
	type RpcRequest,
	type RpcRequestMessage,
	type RpcResponse,
} from '../../shared/rpc-types';
import { nanoid } from 'nanoid';

interface PendingRequest<T = unknown> {
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
	procedure: RpcProcedure;
	startTime: number;
}

interface RpcClientConfig {
	defaultTimeout: number;
	debug: boolean;
}

const DEFAULT_CONFIG: RpcClientConfig = {
	defaultTimeout: 30_000,
	debug: false,
};

class RpcClient {
	private pending = new Map<string, PendingRequest>();
	private initialized = false;
	private handleMessage = this.onMessage.bind(this);
	private config: RpcClientConfig;

	constructor(config: Partial<RpcClientConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	init(): void {
		if (this.initialized) {
			this.log('RPC client already initialized, skipping');
			return;
		}

		window.addEventListener('message', this.handleMessage);
		this.initialized = true;
		this.log('RPC client initialized');
	}

	destroy(): void {
		if (!this.initialized) return;

		window.removeEventListener('message', this.handleMessage);

		const pendingCount = this.pending.size;

		for (const [id, request] of this.pending) {
			clearTimeout(request.timeoutId);
			request.reject(
				new Error(`RPC client destroyed while "${request.procedure}" was pending`),
			);
		}

		this.pending.clear();

		this.initialized = false;
		this.log(`RPC client destroyed, cancelled ${pendingCount} pending requests`);
	}

	call<T extends RpcProcedure>(
		procedure: T,
		payload: RpcRequest<T>,
		options?: { timeout?: number },
	): Promise<RpcResponse<T>> {
		if (!this.initialized) {
			return Promise.reject(new Error('RPC client not initialized. Call rpc.init() first.'));
		}

		// const id = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
		const id = nanoid();
		const timeout = options?.timeout ?? this.config.defaultTimeout;
		const startTime = Date.now();

		this.log(`Calling "${procedure}" with id ${id}`, payload);

		return new Promise<RpcResponse<T>>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this.pending.has(id)) {
					this.pending.delete(id);
					const elapsed = Date.now() - startTime;
					reject(
						new Error(
							`RPC call "${procedure}" timed out after ${elapsed}ms (limit: ${timeout}ms)`,
						),
					);
				}
			}, timeout);

			this.pending.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeoutId,
				procedure,
				startTime,
			});

			const message: RpcRequestMessage<T> = {
				__rpc: true,
				id,
				procedure,
				payload,
			};

			parent.postMessage({ pluginMessage: message }, '*');
		});
	}

	private onMessage(event: MessageEvent): void {
		const msg = event.data?.pluginMessage;

		if (!msg || !isRpcResponse(msg)) {
			return;
		}

		const { id, procedure, response, error } = msg;
		const pending = this.pending.get(id);

		if (!pending) {
			this.log(`Received response for unknown id: ${id}`, msg);
			return;
		}

		clearTimeout(pending.timeoutId);
		this.pending.delete(id);

		const duration = Date.now() - pending.startTime;

		if (error !== undefined) {
			this.log(`"${procedure}" failed after ${duration}ms:`, error);
			pending.reject(new Error(error));
		} else {
			this.log(`"${procedure}" succeeded after ${duration}ms:`, response);
			pending.resolve(response);
		}
	}

	private log(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(`[RPC] ${message}`, data ?? '');
		}
	}

	getPendingCount(): number {
		return this.pending.size;
	}

	isInitialized(): boolean {
		return this.initialized;
	}
}

export const rpcClient = new RpcClient({ debug: false });

export function callPlugin<T extends RpcProcedure>(
	procedure: T,
	payload: RpcRequest<T>,
	options?: { timeout?: number },
): Promise<RpcResponse<T>> {
	return rpcClient.call(procedure, payload, options);
}

export { RpcClient };
export type { RpcClientConfig };
