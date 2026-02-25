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
import { formatDuration, logger } from './logger';

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
}

const DEFAULT_CONFIG: RpcClientConfig = {
	defaultTimeout: 30_000,
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
			return;
		}

		window.addEventListener('message', this.handleMessage);
		this.initialized = true;
		logger.log('[Plugin UI] Initialized');
	}

	destroy(): void {
		if (!this.initialized) return;

		window.removeEventListener('message', this.handleMessage);

		for (const [, request] of this.pending) {
			clearTimeout(request.timeoutId);
			request.reject(
				new Error(`RPC client destroyed while "${request.procedure}" was pending`),
			);
		}

		this.pending.clear();
		this.initialized = false;
	}

	call<T extends RpcProcedure>(
		procedure: T,
		payload?: RpcRequest<T>,
		options?: { timeout?: number },
	): Promise<RpcResponse<T>> {
		if (!this.initialized) {
			return Promise.reject(new Error('RPC client not initialized. Call rpc.init() first.'));
		}

		const id = nanoid();
		const timeout = options?.timeout ?? this.config.defaultTimeout;
		const startTime = Date.now();

		logger.debug(`[RPC Client] "${procedure}"`);

		return new Promise<RpcResponse<T>>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this.pending.has(id)) {
					this.pending.delete(id);
					const elapsed = Date.now() - startTime;
					reject(
						new Error(
							`RPC call "${procedure}" timed out after ${formatDuration(elapsed)} (limit: ${formatDuration(timeout)})`,
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

		return () => {
			handlers.delete(handler);
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
			return;
		}

		clearTimeout(pending.timeoutId);
		this.pending.delete(id);

		const duration = Date.now() - pending.startTime;

		if (error !== undefined) {
			logger.error(`[RPC Client] Error in "${procedure}": ${error}`);
			pending.reject(new Error(error));
		} else {
			logger.debug(`[RPC Client] "${procedure}" completed in ${formatDuration(duration)}`);
			pending.resolve(response);
		}
	}

	private handleNotification(notification: RpcNotification, payload: unknown): void {
		const handlers = this.notificationHandlers[notification];
		if (!handlers || handlers.size === 0) {
			return;
		}

		handlers.forEach((handler) => {
			try {
				(handler as NotificationHandler<typeof notification>)(
					payload as RpcNotificationPayload<typeof notification>,
				);
			} catch (error) {
				logger.error(`[RPC Client] Error in handler for "${notification}":`, error);
			}
		});
	}

	getPendingCount(): number {
		return this.pending.size;
	}

	isInitialized(): boolean {
		return this.initialized;
	}
}

export const rpcClient = new RpcClient();

export function callPlugin<T extends RpcProcedure>(
	procedure: T,
	payload?: RpcRequest<T>,
	options?: { timeout?: number },
): Promise<RpcResponse<T>> {
	return rpcClient.call(procedure, payload, options);
}

export { RpcClient };
export type { RpcClientConfig };
