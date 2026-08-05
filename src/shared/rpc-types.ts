import type { RpcProcedureSchema, RpcNotificationSchema } from 'figma-plugin-rpc';

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

export interface PluginProcedures extends RpcProcedureSchema {
	'get-variables': {
		request: void;
		response: { variables: Variable[] };
	};

	'variableSearch.start': {
		request: { variableId: string; scope: SearchScope; searchId: string };
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

export interface PluginNotifications extends RpcNotificationSchema {
	'variableSearch.results': {
		searchId: string;
		results: VariableUsage[];
		isComplete: boolean;
		fromCache?: boolean;
	};
	'variableSearch.progress': SearchProgress & { searchId: string };
	'variableSearch.error': { searchId: string; error: string };
}

export type SearchNotifier = {
	notify<T extends keyof PluginNotifications & string>(
		notification: T,
		payload: PluginNotifications[T],
	): void;
};
