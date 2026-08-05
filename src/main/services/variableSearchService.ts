import { NodeType, SearchScope, VariableUsage } from '../../shared/rpc-types';
import { formatDuration, logger } from '../../shared/logger';
import type { SearchNotifier } from '../../shared/rpc-types';
import { SCOPE_SELECTION } from '../../shared/constants';
import { extractBindings } from './binding-extractor';
import { SearchCache } from './search-cache';
import { findNodesWithBindingsAsync, yieldToMain } from './node-traverser';
import { buildNodePath } from './node-path-builder';
import { resolveSearchTargets } from './search-target-resolver';

const RESULTS_BATCH_SIZE = 50;
const NODES_PER_PROGRESS = 500;

class VariableSearchService {
	private cache = new SearchCache();
	private activeSearchId: string | null = null;
	private isInitialized: boolean = false;
	private notifier: SearchNotifier;

	constructor(notifier: SearchNotifier) {
		this.notifier = notifier;
	}

	async init(): Promise<void> {
		if (this.isInitialized) return;

		await figma.loadAllPagesAsync();
		this.cache.startTracking();

		this.isInitialized = true;
		logger.log('[VariableSearch] Initialized');
	}

	clearCache(variableId?: string): void {
		this.cache.clear(variableId);
	}

	cancelSearch(): void {
		if (this.activeSearchId) {
			logger.log('[VariableSearch] Cancelled');
			this.activeSearchId = null;
		}
	}

	async search(variableId: string, scope: SearchScope, searchId: string): Promise<void> {
		this.activeSearchId = searchId;
		const startTime = Date.now();

		const cacheKey = this.cache.keyFor(variableId, scope);
		const cached = this.cache.get(cacheKey);

		if (cached && this.cache.isValid(cached)) {
			logger.log(
				`[VariableSearch] Cache hit: ${cached.results.length} results (${formatDuration(Date.now() - startTime)})`,
			);

			await this.streamCachedResults(searchId, cached.results);

			this.notifier.notify('variableSearch.progress', {
				searchId,
				processed: cached.results.length,
				total: cached.results.length,
				currentPage: 'Cached',
				nodesProcessed: cached.results.length,
			});

			this.activeSearchId = null;
			return;
		}

		if (scope === SCOPE_SELECTION && figma.currentPage.selection.length === 0) {
			this.notifier.notify('variableSearch.results', {
				searchId,
				results: [],
				isComplete: true,
			});

			this.notifier.notify('variableSearch.progress', {
				searchId,
				processed: 0,
				total: 0,
				currentPage: 'No selection',
				nodesProcessed: 0,
			});

			this.activeSearchId = null;
			return;
		}

		const signal = { cancelled: false };
		const previousSkipInvisible = figma.skipInvisibleInstanceChildren;

		try {
			figma.skipInvisibleInstanceChildren = true;

			const allResults: VariableUsage[] = [];
			const targets = await resolveSearchTargets(scope);

			const totalTopLevelNodes = targets.reduce((sum, t) => sum + t.topLevelNodes.length, 0);

			let processedTopLevelNodes = 0;
			let nodesProcessed = 0;
			let pendingResults: VariableUsage[] = [];
			const pathCache = new Map<string, string>();

			for (const { page, topLevelNodes } of targets) {
				if (!this.isActiveSearch(searchId)) {
					signal.cancelled = true;
					return;
				}

				const pageId = page.id;
				const pageName = page.name;

				for (const topNode of topLevelNodes) {
					if (!this.isActiveSearch(searchId)) {
						signal.cancelled = true;
						return;
					}

					const generator = findNodesWithBindingsAsync(topNode, signal);

					for await (const node of generator) {
						if (!this.isActiveSearch(searchId)) {
							signal.cancelled = true;
							return;
						}

						const fields = extractBindings(node, variableId);

						if (fields) {
							for (const field of fields) {
								const usage: VariableUsage = {
									nodeId: node.id,
									nodeName: node.name,
									nodeType: node.type as NodeType,
									field: field.replace('[0]', ''),
									pageName,
									pageId,
									nodePath: buildNodePath(node, pathCache),
								};
								allResults.push(usage);
								pendingResults.push(usage);
							}
						}

						if (pendingResults.length >= RESULTS_BATCH_SIZE) {
							this.notifier.notify('variableSearch.results', {
								searchId,
								results: pendingResults,
								isComplete: false,
							});
							pendingResults = [];
						}

						nodesProcessed++;

						if (nodesProcessed % NODES_PER_PROGRESS === 0) {
							this.notifier.notify('variableSearch.progress', {
								searchId,
								processed: processedTopLevelNodes,
								total: totalTopLevelNodes,
								currentPage: pageName,
								nodesProcessed,
							});
						}
					}

					processedTopLevelNodes++;

					this.notifier.notify('variableSearch.progress', {
						searchId,
						processed: processedTopLevelNodes,
						total: totalTopLevelNodes,
						currentPage: pageName,
						nodesProcessed,
					});
				}
			}

			if (pendingResults.length > 0) {
				this.notifier.notify('variableSearch.results', {
					searchId,
					results: pendingResults,
					isComplete: false,
				});
			}

			this.notifier.notify('variableSearch.results', {
				searchId,
				results: [],
				isComplete: true,
			});

			this.notifier.notify('variableSearch.progress', {
				searchId,
				processed: totalTopLevelNodes,
				total: totalTopLevelNodes,
				currentPage: 'Complete',
				nodesProcessed,
			});

			this.cache.set(cacheKey, {
				variableId,
				scope,
				results: allResults,
				timestamp: Date.now(),
				documentChangeCount: this.cache.getDocumentChangeCount(),
				selectionKey: scope === SCOPE_SELECTION ? this.cache.getSelectionKey() : undefined,
			});

			logger.log(
				`[VariableSearch] Done: ${allResults.length} results in ${formatDuration(Date.now() - startTime)}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.notifier.notify('variableSearch.error', { searchId, error: message });
		} finally {
			figma.skipInvisibleInstanceChildren = previousSkipInvisible;
			if (this.activeSearchId === searchId) {
				this.activeSearchId = null;
			}
		}
	}

	private isActiveSearch(searchId: string): boolean {
		return this.activeSearchId === searchId;
	}

	private async streamCachedResults(searchId: string, results: VariableUsage[]): Promise<void> {
		for (let i = 0; i < results.length; i += RESULTS_BATCH_SIZE) {
			const batch = results.slice(i, i + RESULTS_BATCH_SIZE);
			const isLast = i + RESULTS_BATCH_SIZE >= results.length;

			this.notifier.notify('variableSearch.results', {
				searchId,
				results: batch,
				isComplete: isLast,
				fromCache: true,
			});

			if (!isLast) {
				await yieldToMain();
			}
		}

		if (results.length === 0) {
			this.notifier.notify('variableSearch.results', {
				searchId,
				results: [],
				isComplete: true,
				fromCache: true,
			});
		}
	}
}

export { VariableSearchService };
