export type SearchScope = 'all-pages' | 'current-page' | 'selection';

export interface VariableSearchConfig {
	batchSize: number;
	chunkSize: number;
	progressIntervalMs: number;
}

export const DEFAULT_SEARCH_CONFIG: VariableSearchConfig = {
	batchSize: 50,
	chunkSize: 100,
	progressIntervalMs: 100,
};

export interface BreadcrumbSegment {
	nodeId: string;
	nodeName: string;
	nodeType: string;
}

export interface VariableUsageResult {
	nodeId: string;
	nodeName: string;
	nodeType: string;
	pageName: string;
	pageId: string;
	propertyPath: string;
	breadcrumbs: BreadcrumbSegment[];
}

export interface SearchProgressPayload {
	searchId: string;
	progress: number;
	processedNodes: number;
	totalNodes: number;
}

export interface SearchBatchPayload {
	searchId: string;
	results: VariableUsageResult[];
	isFinal: boolean;
}

export interface SearchCompletePayload {
	searchId: string;
	totalFound: number;
	durationMs: number;
	wasCancelled: boolean;
}

export interface SearchStartParams {
	variableId: string;
	scope: SearchScope;
}

export interface SearchStartResult {
	searchId: string;
}

export interface ScopeValidationResult {
	valid: boolean;
	error?: string;
	nodeCount?: number;
}

// For indexing support
export interface VariableIndexEntry {
	variableId: string;
	nodeId: string;
	pageId: string;
	propertyPath: string;
}

export interface ISearchIndex {
	isBuilt(): boolean;
	build(onProgress?: (progress: number) => void): Promise<void>;
	query(variableId: string, scope: SearchScope): VariableIndexEntry[];
	invalidateNode(nodeId: string): void;
	invalidatePage(pageId: string): void;
	clear(): void;
}
