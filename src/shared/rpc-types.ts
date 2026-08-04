export interface Variable {
	id: string;
	name: string;
	resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';
	hiddenFromPublishing: boolean;
	remote?: boolean;
}

export type NodeType =
	| 'BOOLEAN_OPERATION'
	| 'COMPONENT'
	| 'COMPONENT_SET'
	| 'CONNECTOR'
	| 'ELLIPSE'
	| 'EMBED'
	| 'FRAME'
	| 'GROUP'
	| 'HIGHLIGHT'
	| 'INSTANCE'
	| 'LINE'
	| 'LINK_UNFURL'
	| 'MEDIA'
	| 'PAGE'
	| 'POLYGON'
	| 'RECTANGLE'
	| 'SECTION'
	| 'SHAPE_WITH_TEXT'
	| 'SLICE'
	| 'STAMP'
	| 'STAR'
	| 'STICKY'
	| 'TABLE'
	| 'TABLE_CELL'
	| 'TEXT'
	| 'VECTOR'
	| 'WASHI_TAPE'
	| 'WIDGET';

export interface VariableUsage {
	nodeId: string;
	nodeName: string;
	nodeType: NodeType;
	field: string; // e.g., 'fills', 'strokes', 'width'
	pageName: string;
	pageId: string;
	nodePath: string; // e.g., 'Highest Node/.../Parent Node/Current Node'
}

export interface SearchProgress {
	processed: number;
	total: number;
	currentPage: string;
	nodesProcessed?: number;
}

export type SearchScope = 'all-pages' | 'current-page' | 'selection';

export interface RpcProcedureSchema {
	'get-variables': {
		request: void;
		response: { variables: Variable[] };
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
		searchId: string;
		results: VariableUsage[];
		isComplete: boolean;
		fromCache?: boolean;
	};
	'variableSearch.progress': SearchProgress & { searchId: string };
	'variableSearch.error': { searchId: string; error: string };
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

export type RpcResponseMessage<T extends RpcProcedure = RpcProcedure> =
	| {
			__rpc: true;
			id: string;
			procedure: T;
			response: RpcResponse<T>;
	  }
	| {
			__rpc: true;
			id: string;
			procedure: T;
			error: string;
	  };

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
