import type {
	VariableUsage,
	SearchProgress,
	SearchScope,
	RpcNotification,
	RpcNotificationPayload,
} from '../../shared/rpc-types';
import { AsyncTreeTraverser, TraversalContext } from '../lib/async-traverser';
import { ScopeResolver } from './scope-resolver';
import { VariableBindingDetector } from './variable-binding-detector';

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

type NotifySender = <T extends RpcNotification>(
	notification: T,
	payload: RpcNotificationPayload<T>,
) => void;

export class VariableSearchService {
	private activeSearchId: string | null = null;
	private config: VariableSearchConfig;
	private notify: NotifySender;

	private traverser: AsyncTreeTraverser;
	private detector: VariableBindingDetector;
	private scopeResolver: ScopeResolver;

	constructor(notify: NotifySender, config: Partial<VariableSearchConfig> = {}) {
		this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
		this.notify = notify;

		this.traverser = new AsyncTreeTraverser({
			chunkSize: this.config.chunkSize,
		});
		this.detector = new VariableBindingDetector();
		this.scopeResolver = new ScopeResolver();
	}

	async startSearch(variableId: string, scope: SearchScope): Promise<boolean> {
		const validation = this.scopeResolver.validate(scope);
		if (!validation.valid) {
			this.notify('variableSearch.error', { error: validation.error! });
			return false;
		}

		this.cancelSearch();

		const searchId = this.generateSearchId();
		this.activeSearchId = searchId;

		// Fire and forget - results come via notifications
		this.executeSearch(searchId, variableId, scope).catch((err) => {
			if (this.activeSearchId === searchId) {
				this.notify('variableSearch.error', {
					error: err instanceof Error ? err.message : 'Search failed',
				});
				this.activeSearchId = null;
			}
		});

		return true;
	}

	cancelSearch(): boolean {
		if (this.activeSearchId) {
			this.activeSearchId = null;
			return true;
		}
		return false;
	}

	private async executeSearch(
		searchId: string,
		variableId: string,
		scope: SearchScope,
	): Promise<void> {
		figma.skipInvisibleInstanceChildren = true;
		await figma.loadAllPagesAsync();
		const resolvedScope = this.scopeResolver.resolve(scope);

		const totalNodes = resolvedScope.isSelectionScope
			? await this.traverser.countNodesInRoots(resolvedScope.rootNodes)
			: await this.traverser.countNodesInPages(resolvedScope.pages);

		if (this.activeSearchId !== searchId) return;

		let processedNodes = 0;
		let currentPageName = '';
		let lastProgressUpdate = Date.now();
		const batch: VariableUsage[] = [];

		const callbacks = {
			onNode: (ctx: TraversalContext): boolean => {
				processedNodes++;
				currentPageName = ctx.pageName;

				const fields = this.detector.findBindingsForVariable(ctx.node, variableId);

				for (const field of fields) {
					batch.push({
						nodeId: ctx.node.id,
						nodeName: ctx.node.name,
						nodeType: ctx.node.type,
						field,
						pageId: ctx.pageId,
						pageName: ctx.pageName,
					});

					if (batch.length >= this.config.batchSize) {
						this.notify('variableSearch.results', {
							results: [...batch],
							isComplete: false,
						});
						batch.length = 0;
					}
				}

				const now = Date.now();
				if (now - lastProgressUpdate >= this.config.progressIntervalMs) {
					this.notify('variableSearch.progress', {
						processed: processedNodes,
						total: totalNodes,
						currentPage: currentPageName,
					});
					lastProgressUpdate = now;
				}

				return true;
			},

			shouldCancel: () => this.activeSearchId !== searchId,
		};

		const result = resolvedScope.isSelectionScope
			? await this.traverser.traverseNodes(
					resolvedScope.rootNodes,
					resolvedScope.selectionPageContext!,
					callbacks,
				)
			: await this.traverser.traversePages(resolvedScope.pages, callbacks);

		if (result.wasCancelled) return;

		// Final batch
		this.notify('variableSearch.results', {
			results: batch,
			isComplete: true,
		});

		this.notify('variableSearch.progress', {
			processed: totalNodes,
			total: totalNodes,
			currentPage: currentPageName,
		});

		this.activeSearchId = null;
	}

	private generateSearchId(): string {
		return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
	}
}
