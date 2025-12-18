import {
	isRpcNotification,
	isRpcRequest,
	RpcNotification,
	RpcNotificationMessage,
	RpcNotificationPayload,
	RpcProcedure,
	RpcRequest,
	RpcResponse,
	RpcResponseMessage,
} from '../../shared/rpc-types';

type RpcHandler<T extends RpcProcedure> = (
	payload: RpcRequest<T>,
) => RpcResponse<T> | Promise<RpcResponse<T>>;

type HandlerRegistry = Partial<{
	[K in RpcProcedure]: RpcHandler<K>;
}>;

interface RpcServerConfig {
	debug: boolean;
	onError?: (procedure: string, error: Error) => void;
}

const DEFAULT_CONFIG: RpcServerConfig = {
	debug: false,
	onError: (procedure, error) => {
		console.error(`[RPC Server] Error in procedure "${procedure}":`, error);
	},
};

class RpcServer {
	private handlers: HandlerRegistry = {};
	private config: RpcServerConfig;

	constructor(config: Partial<RpcServerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	registerHandler<T extends RpcProcedure>(procedure: T, handler: RpcHandler<T>): this {
		if (this.handlers[procedure]) {
			console.warn(`[RPC Server] Overwriting existing handler for "${procedure}"`);
		}

		this.handlers[procedure] = handler as HandlerRegistry[T];
		this.log(`Registered handler for "${procedure}"`);

		return this;
	}

	async processMessage(msg: unknown): Promise<boolean> {
		if (!isRpcRequest(msg)) {
			return false;
		}

		const { id, procedure, payload } = msg;
		const startTime = Date.now();

		this.log(`Received "${procedure}" (id: ${id})`);

		// Find handler
		const handler = this.handlers[procedure];

		if (!handler) {
			this.sendError(id, procedure, `Unknown procedure: "${procedure}"`);
			console.error(`[RPC Server] No handler for "${procedure}"`);
			return true;
		}

		try {
			const response = await Promise.resolve(
				(handler as RpcHandler<typeof procedure>)(payload),
			);

			const duration = Date.now() - startTime;
			this.log(`"${procedure}" completed in ${duration}ms`);

			this.sendResponse(id, procedure, response);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			const duration = Date.now() - startTime;
			console.error(`[RPC Server] "${procedure}" failed after ${duration} ms:`, error);

			// Call error hook if configured
			if (this.config.onError) {
				this.config.onError(
					procedure,
					error instanceof Error ? error : new Error(errorMessage),
				);
			}
		}

		return true;
	}

	notify<T extends RpcNotification>(notification: T, payload: RpcNotificationPayload<T>): void {
		const message: RpcNotificationMessage<T> = {
			__rpcNotification: true,
			notification,
			payload,
		};

		figma.ui.postMessage(message);
		this.log(`Sent notification "${notification}"`, message);
	}

	hasHandler(procedure: RpcProcedure): boolean {
		return procedure in this.handlers;
	}

	getRegisteredProcedures(): RpcProcedure[] {
		return Object.keys(this.handlers) as RpcProcedure[];
	}

	private sendResponse<T extends RpcProcedure>(
		id: string,
		procedure: T,
		response: RpcResponse<T>,
	): void {
		const message = {
			__rpc: true,
			id,
			procedure,
			response,
		};

		figma.ui.postMessage(message);
	}

	private sendError(id: string, procedure: RpcProcedure, error: string): void {
		const message: RpcResponseMessage = {
			__rpc: true,
			id,
			procedure,
			error,
		};

		figma.ui.postMessage(message);
	}

	private log(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(
				`%c[RPC Server] ${message}`,
				'color: #fff; background: #7c3aed; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
				data ?? '',
			);
		}
	}
}

export const rpcServer = new RpcServer({ debug: true });

export { RpcServer };
export type { RpcHandler, RpcServerConfig };
