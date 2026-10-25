import type { RpcProcedureSchema, RpcNotificationSchema } from 'figma-plugin-rpc';

export interface Variable {
	id: string;
	name: string;
	resolvedType: VariableResolvedType;
	hiddenFromPublishing: boolean;
	remote?: boolean;
	variableCollectionId?: string;
	collectionName?: string;
}

export type VariableResolvedType = 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR' | 'EASING' | 'TIMING';

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

export interface UnusedScanProgress {
	processed: number;
	total: number;
	currentPage: string;
	pageIndex: number;
	pageCount: number;
}

export interface VariableChainStep {
	name: string;
	isPalette: boolean;
}

/** How one variable resolves, step by step, for one or more modes that resolve the same way. */
export interface VariableChain {
	modes: string[];
	allModes: boolean;
	steps: VariableChainStep[];
	/** Display value at the end of the chain, e.g. '#0C447C', '16', '"Save 20%"'. */
	value: string;
	/** CSS colour for COLOR variables, used for the swatch. */
	color: string | null;
	/** Opacity in percent for COLOR variables. */
	opacity: number | null;
}

export interface UnusedVariable {
	id: string;
	name: string;
	resolvedType: VariableResolvedType;
	collectionId: string;
	collectionName: string;
	isPalette: boolean;
	/** The unused variable this one is shown under, if it belongs to an unused group. */
	parentId: string | null;
	/** Unused variables that point to this one. They have to be deleted with it. */
	usedBy: { id: string; name: string }[];
	chains: VariableChain[];
}

export interface UnusedScanResult {
	totalVariables: number;
	unused: UnusedVariable[];
	publishedNames: string[];
}

export type UnusedDeleteErrorCode =
	/** There's no finished scan to delete from. */
	| 'NOT_SCANNED'
	/** The file changed since the scan, or the request is for an older scan. Rescan first. */
	| 'STALE'
	/** A scan or another delete is running. */
	| 'BUSY'
	/** A version couldn't be saved first, so nothing was deleted. */
	| 'VERSION_FAILED'
	/** Some variables were deleted, then removing one failed. `deletedIds` lists the deleted ones. */
	| 'PARTIAL';

export interface UnusedDeleteResult {
	deletedIds: string[];
	/** Requested variables that are in use now, so they were kept. */
	skippedIds: string[];
	versionSaved: boolean;
	error?: { code: UnusedDeleteErrorCode; message: string };
}

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

	'unusedScan.start': {
		request: { scanId: string };
		response: { started: boolean };
	};
	'unusedScan.cancel': {
		request: void;
		response: { cancelled: boolean };
	};
	'unusedScan.delete': {
		/** `ids` must include the unused variables that point to them; nothing else gets deleted. */
		request: { scanId: string; ids: string[] };
		response: UnusedDeleteResult;
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
	'unusedScan.progress': UnusedScanProgress & { scanId: string };
	'unusedScan.complete': { scanId: string; result: UnusedScanResult };
	'unusedScan.error': { scanId: string; error: string };
	'unusedScan.stale': { scanId: string };
}

export type SearchNotifier = {
	notify<T extends keyof PluginNotifications & string>(
		notification: T,
		payload: PluginNotifications[T],
	): void;
};
