import {
	isRpcNotification,
	isRpcResponse,
	type RpcNotification,
	type RpcNotificationPayload,
	type RpcProcedure,
	type RpcRequest,
	type RpcRequestMessage,
	type RpcResponse,
	type RpcResponseMessage,
} from '../../shared/rpc-types';
import { nanoid } from 'nanoid';

interface PendingRequest<T = unknown> {
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
	procedure: RpcProcedure;
	startTime: number;
}

type NotificationHandler<T extends RpcNotification> = (payload: RpcNotificationPayload<T>) => void;

type NotificationHandlerRegistry = Partial<{
	[K in RpcNotification]: Set<NotificationHandler<K>>;
}>;

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
	private notificationHandlers: NotificationHandlerRegistry = {};
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

		for (const [, request] of this.pending) {
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
		payload?: RpcRequest<T>,
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

	on<T extends RpcNotification>(notification: T, handler: NotificationHandler<T>): () => void {
		if (!this.notificationHandlers[notification]) {
			this.notificationHandlers[notification] = new Set();
		}

		const handlers = this.notificationHandlers[notification] as Set<NotificationHandler<T>>;
		handlers.add(handler);

		this.log(`Subscribed to "${notification}"`);

		// Return unsubscribe function
		return () => {
			handlers.delete(handler);
			this.log(`Unsubscribed from "${notification}"`);
		};
	}

	once<T extends RpcNotification>(
		notification: T,
		handler: (payload: RpcNotificationPayload<T>) => boolean,
	): () => void {
		const unsubscribe = this.on(notification, (payload) => {
			const shouldUnsubscribe = handler(payload);
			if (shouldUnsubscribe) {
				unsubscribe();
			}
		});

		return unsubscribe;
	}

	private onMessage(event: MessageEvent): void {
		const msg = event.data?.pluginMessage;

		if (!msg) return;

		if (isRpcResponse(msg)) {
			this.handleResponse(msg);
			return;
		}

		if (isRpcNotification(msg)) {
			this.handleNotification(msg.notification, msg.payload);
			return;
		}
	}

	private handleResponse(msg: RpcResponseMessage): void {
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

	private handleNotification(notification: RpcNotification, payload: unknown): void {
		this.log(`Received notification "${notification}"`);

		const handlers = this.notificationHandlers[notification];
		if (!handlers || handlers.size === 0) {
			this.log(`No handlers for "${notification}"`);
			return;
		}

		handlers.forEach((handler) => {
			try {
				(handler as NotificationHandler<typeof notification>)(
					payload as RpcNotificationPayload<typeof notification>,
				);
			} catch (error) {
				console.error(`[RPC Client] Handler error for "${notification}":`, error);
			}
		});
	}

	private log(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(
				'%c[RPC Client] ' + message,
				'color: #fff; background: #2563eb; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
				data ?? '',
			);
		}
	}

	getPendingCount(): number {
		return this.pending.size;
	}

	isInitialized(): boolean {
		return this.initialized;
	}
}

export const rpcClient = new RpcClient({ debug: true });

export function callPlugin<T extends RpcProcedure>(
	procedure: T,
	payload?: RpcRequest<T>,
	options?: { timeout?: number },
): Promise<RpcResponse<T>> {
	return rpcClient.call(procedure, payload, options);
}

export { RpcClient };
export type { RpcClientConfig };
