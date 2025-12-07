// const RPC_MARKER = '__rpc' as const;

// interface RpcMessageBase {
// 	[RPC_MARKER]: true;
// 	id: string;
// }

export interface Variable {
	id: string;
	name: string;
	resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';
	collectionId?: string;
	collectionName?: string;
}

export interface VariableUsage {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	field: string; // e.g., 'fills', 'strokes', 'width'
	pageName: string;
	pageId: string;
}

export interface RpcSchema {
	'get-variables': {
		request: void;
		response: { variables: Variable[] };
	};

	'find-usage': {
		request: { variableId: string };
		response: { usages: VariableUsage[] };
	};

	'zoom-to-node': {
		request: { nodeId: string; pageId: string };
		response: { success: boolean };
	};

	'get-collections': {
		request: void;
		response: { collections: { id: string; name: string }[] };
	};
}

export type RpcProcedure = keyof RpcSchema;

export type RpcRequest<T extends RpcProcedure> = RpcSchema[T]['request'];

export type RpcResponse<T extends RpcProcedure> = RpcSchema[T]['response'];

export interface RpcRequestMessage<T extends RpcProcedure = RpcProcedure> {
	__rpc: true;
	id: string;
	procedure: T;
	payload: RpcRequest<T>;
}

export interface RpcResponseMessage<T extends RpcProcedure = RpcProcedure> {
	__rpc: true;
	id: string;
	procedure: T;
	response?: RpcResponse<T>;
	error?: string;
}

export function isRpcRequest(msg: unknown): msg is RpcRequestMessage {
	return (
		typeof msg === 'object' &&
		msg !== null &&
		'__rpc' in msg &&
		(msg as Record<string, unknown>).__rpc === true &&
		'procedure' in msg &&
		'payload' in msg
	);
}

export function isRpcResponse(msg: unknown): msg is RpcResponseMessage {
	return (
		typeof msg === 'object' &&
		msg !== null &&
		'__rpc' in msg &&
		(msg as Record<string, unknown>).__rpc === true &&
		('response' in msg || 'error' in msg)
	);
}
