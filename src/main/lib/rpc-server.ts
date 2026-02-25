import {
	isRpcRequest,
	RpcNotification,
	RpcNotificationMessage,
	RpcNotificationPayload,
	RpcProcedure,
	RpcRequest,
	RpcResponse,
	RpcResponseMessage,
} from '../../shared/rpc-types';
import { formatDuration, logger } from './logger';

type RpcHandler<T extends RpcProcedure> = (
	payload: RpcRequest<T>,
) => RpcResponse<T> | Promise<RpcResponse<T>>;

type HandlerRegistry = Partial<{
	[K in RpcProcedure]: RpcHandler<K>;
}>;

interface RpcServerConfig {
	onError?: (procedure: string, error: Error) => void;
}

const DEFAULT_CONFIG: RpcServerConfig = {
	onError: (procedure, error) => {
		logger.error(`[RPC Server] Error in procedure "${procedure}":`, error);
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
			logger.warn(`[RPC Server] Overwriting existing handler for "${procedure}"`);
		}

		this.handlers[procedure] = handler as HandlerRegistry[T];

		return this;
	}

	async processMessage(msg: unknown): Promise<boolean> {
		if (!isRpcRequest(msg)) {
			return false;
		}

		const { id, procedure } = msg;
		const startTime = Date.now();

		logger.debug(`[RPC Server] "${procedure}"`);

		const handler = this.handlers[procedure];

		if (!handler) {
			this.sendError(id, procedure, `Unknown procedure: "${procedure}"`);
			logger.error(`[RPC Server] Error: No handler for "${procedure}"`);
			return true;
		}

		try {
			const response = await Promise.resolve(
				(handler as RpcHandler<typeof procedure>)(msg.payload),
			);

			logger.debug(
				`[RPC Server] "${procedure}" completed in ${formatDuration(Date.now() - startTime)}`,
			);

			this.sendResponse(id, procedure, response);
		} catch (error) {
			logger.error(`[RPC Server] Error in "${procedure}":`, error);

			if (this.config.onError) {
				this.config.onError(
					procedure,
					error instanceof Error ? error : new Error(String(error)),
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
}

export const rpcServer = new RpcServer();

export { RpcServer };
export type { RpcHandler, RpcServerConfig };
