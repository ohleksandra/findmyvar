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

export interface SearchProgress {
	processed: number;
	total: number;
	currentPage: string;
}

export type SearchScope = 'all-pages' | 'current-page' | 'selection';

export interface RpcProcedureSchema {
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
	'variableSearch.start': {
		request: { variableId: string; scope: SearchScope };
		response: { started: boolean };
	};
	'variableSearch.cancel': {
		request: void;
		response: { cancelled: boolean };
	};
	'variableSearch.clearCache': {
		request: { variableId?: string } | void;
		response: { cleared: boolean };
	};
	'variableSearch.navigateTo': {
		request: { nodeId: string; pageId: string };
		response: { success: boolean; error?: string };
	};
}

export interface RpcNotificationSchema {
	'variableSearch.results': {
		results: VariableUsage[];
		isComplete: boolean;
	};
	'variableSearch.progress': SearchProgress;
	'variableSearch.error': { error: string };
}

export type RpcProcedure = keyof RpcProcedureSchema;

export type RpcNotification = keyof RpcNotificationSchema;

export type RpcRequest<T extends RpcProcedure> = RpcProcedureSchema[T]['request'];

export type RpcResponse<T extends RpcProcedure> = RpcProcedureSchema[T]['response'];

export type RpcNotificationPayload<T extends RpcNotification> = RpcNotificationSchema[T];

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

export interface RpcNotificationMessage<T extends RpcNotification = RpcNotification> {
	__rpcNotification: true;
	notification: T;
	payload: RpcNotificationPayload<T>;
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

export function isRpcNotification(msg: unknown): msg is RpcNotificationMessage {
	return (
		typeof msg === 'object' &&
		msg !== null &&
		'__rpcNotification' in msg &&
		(msg as Record<string, unknown>).__rpcNotification === true
	);
}
