import { NodeType, SearchScope, VariableUsage } from '../../shared/rpc-types';
import { formatDuration, logger } from '../../shared/logger';
import type { SearchNotifier } from '../../shared/rpc-types';
import { SCOPE_ALL_PAGES, SCOPE_CURRENT_PAGE, SCOPE_SELECTION } from '../../shared/constants';

interface CacheEntry {
	variableId: string;
	timestamp: number;
	results: VariableUsage[];
	documentChangeCount: number;
	selectionKey?: string;
	scope: SearchScope;
}

interface SearchTarget {
	page: PageNode;
	topLevelNodes: SceneNode[];
}

const CACHE_TTL = 5 * 60 * 1000;
const RESULTS_BATCH_SIZE = 50;
const NODES_PER_YIELD = 200;
const NODES_PER_PROGRESS = 500;
const MAX_CACHE_ENTRIES = 20;
const DOCUMENT_CHANGE_DEBOUNCE_MS = 500;

class VariableSearchService {
	private cache: Map<string, CacheEntry> = new Map();
	private documentChangeCount: number = 0;
	private activeSearchId: string | null = null;
	private isInitialized: boolean = false;
	private pendingChangeTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingChangeHasRelevant: boolean = false;
	private notifier: SearchNotifier;

	constructor(notifier: SearchNotifier) {
		this.notifier = notifier;
	}

	async init(): Promise<void> {
		if (this.isInitialized) return;

		await figma.loadAllPagesAsync();

		figma.on('documentchange', (event: DocumentChangeEvent) => {
			this.handleDocumentChange(event);
		});

		this.isInitialized = true;
		logger.log('[VariableSearch] Initialized');
	}

	clearCache(variableId?: string): void {
		if (this.pendingChangeTimer !== null) {
			clearTimeout(this.pendingChangeTimer);
			this.pendingChangeTimer = null;
			this.pendingChangeHasRelevant = false;
		}

		if (variableId) {
			this.cache.delete(variableId);
		} else {
			this.cache.clear();
		}
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

		const cacheKey = this.getCacheKey(variableId, scope);
		const cached = this.getFromCache(cacheKey);

		if (cached && this.isCacheValid(cached)) {
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
			const targets = await this.getSearchTargets(scope);

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

					const generator = this.findNodesWithBindingsAsync(topNode, signal);

					for await (const node of generator) {
						if (!this.isActiveSearch(searchId)) {
							signal.cancelled = true;
							return;
						}

						const fields = this.getVariableBindings(node, variableId);

						if (fields) {
							for (const field of fields) {
								const usage: VariableUsage = {
									nodeId: node.id,
									nodeName: node.name,
									nodeType: node.type as NodeType,
									field: field.replace('[0]', ''),
									pageName,
									pageId,
									nodePath: this.buildNodePath(node, pathCache),
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

			this.addToCache(cacheKey, {
				variableId,
				scope,
				results: allResults,
				timestamp: Date.now(),
				documentChangeCount: this.documentChangeCount,
				selectionKey: scope === SCOPE_SELECTION ? this.getSelectionKey() : undefined,
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

	private hasBoundVariables = (node: SceneNode): boolean => {
		return 'boundVariables' in node && node.boundVariables !== null;
	};

	private async *findNodesWithBindingsAsync(
		node: SceneNode,
		signal: { cancelled: boolean },
	): AsyncGenerator<SceneNode, void, void> {
		let nodesVisited = 0;

		const traverse = async function* (
			currentNode: SceneNode,
			service: VariableSearchService,
		): AsyncGenerator<SceneNode, void, void> {
			if (signal.cancelled) return;

			if (service.hasBoundVariables(currentNode)) {
				yield currentNode;
			}

			if ('children' in currentNode) {
				for (const child of currentNode.children) {
					if (signal.cancelled) return;

					nodesVisited++;
					if (nodesVisited % NODES_PER_YIELD === 0) {
						await service.yieldToMain();
					}

					yield* traverse(child as SceneNode, service);
				}
			}
		};

		yield* traverse(node, this);
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
				await this.yieldToMain();
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

	private getFromCache(key: string): CacheEntry | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			this.cache.delete(key);
			this.cache.set(key, entry);
		}
		return entry;
	}

	private addToCache(key: string, entry: CacheEntry): void {
		if (this.cache.size >= MAX_CACHE_ENTRIES) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}
		this.cache.set(key, entry);
	}

	private handleDocumentChange(event: DocumentChangeEvent): void {
		const relevantChange = event.documentChanges.some((change) => {
			return (
				change.type === 'CREATE' ||
				change.type === 'DELETE' ||
				(change.type === 'PROPERTY_CHANGE' &&
					(change.properties as string[]).includes('boundVariables'))
			);
		});

		if (!relevantChange) return;

		this.pendingChangeHasRelevant = true;

		if (this.pendingChangeTimer === null) {
			this.pendingChangeTimer = setTimeout(() => {
				if (this.pendingChangeHasRelevant) {
					this.documentChangeCount++;
				}
				this.pendingChangeTimer = null;
				this.pendingChangeHasRelevant = false;
			}, DOCUMENT_CHANGE_DEBOUNCE_MS);
		}
	}

	private isCacheValid(entry: CacheEntry): boolean {
		const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
		const isStale = entry.documentChangeCount !== this.documentChangeCount;

		if (isExpired || isStale) return false;

		if (entry.scope === SCOPE_SELECTION) {
			return entry.selectionKey === this.getSelectionKey();
		}

		if (entry.scope === SCOPE_CURRENT_PAGE) {
			const currentCacheKey = this.getCacheKey(entry.variableId, entry.scope);
			const entryCacheKey = `${entry.variableId}:${entry.scope}:${figma.currentPage.id}`;
			return currentCacheKey === entryCacheKey;
		}

		return true;
	}

	private yieldToMain(): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, 0));
	}

	private getVariableBindings(node: SceneNode, targetVariableId: string): string[] | null {
		if (!('boundVariables' in node)) return null;

		const bv = node.boundVariables;
		if (!bv) return null;

		let fields: string[] | null = null;
		const keys = Object.keys(bv);

		for (const key of keys) {
			const binding = (bv as Record<string, unknown>)[key];
			if (!binding) continue;

			if (Array.isArray(binding)) {
				for (let j = 0; j < binding.length; j++) {
					const item = binding[j];
					if (item && typeof item === 'object' && 'id' in item) {
						if ((item as { id: string }).id === targetVariableId) {
							fields ??= [];
							fields.push(`${key}[${j}]`);
						}
					}
				}
			} else if (typeof binding === 'object' && 'id' in binding) {
				if ((binding as { id: string }).id === targetVariableId) {
					fields ??= [];
					fields.push(key);
				}
			}
		}
		return fields;
	}

	private getSelectionKey(): string {
		const selection = figma.currentPage.selection;
		if (selection.length === 0) return 'empty';
		return selection
			.map((node) => node.id)
			.sort()
			.join(',');
	}

	private getCacheKey(variableId: string, scope: SearchScope): string {
		if (scope === SCOPE_SELECTION) {
			const selectionKey = this.getSelectionKey();
			return `${variableId}:${scope}:${selectionKey}`;
		}

		if (scope === SCOPE_CURRENT_PAGE) {
			return `${variableId}:${scope}:${figma.currentPage.id}`;
		}

		return `${variableId}:${scope}`;
	}

	private buildNodePath(node: SceneNode, pathCache?: Map<string, string>): string {
		const parent = node.parent;
		if (!parent) {
			return '';
		}

		if (pathCache) {
			const cached = pathCache.get(parent.id);
			if (cached !== undefined) {
				return cached;
			}
		}

		const path: BaseNode[] = [];
		let current: BaseNode | null = parent;

		while (current && current.type !== 'PAGE' && current.type !== 'SECTION') {
			path.unshift(current);
			current = current.parent;
		}

		if (path.length < 2) {
			const result = path[0]?.name?.trim() || '';
			if (pathCache) {
				pathCache.set(parent.id, result);
			}
			return result;
		}

		let highestName = '';
		for (const pathNode of path.slice(0, -1)) {
			const name = pathNode.name?.trim();
			if (name) {
				highestName = name;
				break;
			}
		}

		const parentName = path[path.length - 1].name?.trim() || '';

		if (!highestName || !parentName) {
			if (pathCache) {
				pathCache.set(parent.id, '');
			}
			return '';
		}

		const result = `${highestName}/.../${parentName}`;
		if (pathCache) {
			pathCache.set(parent.id, result);
		}
		return result;
	}

	private async getSearchTargets(scope: SearchScope): Promise<SearchTarget[]> {
		switch (scope) {
			case SCOPE_ALL_PAGES:
				await figma.loadAllPagesAsync();
				return figma.root.children.map((page) => ({
					page,
					topLevelNodes: page.children as SceneNode[],
				}));

			case SCOPE_CURRENT_PAGE:
				return [
					{
						page: figma.currentPage,
						topLevelNodes: figma.currentPage.children as SceneNode[],
					},
				];

			case SCOPE_SELECTION: {
				const selection = figma.currentPage.selection;
				if (selection.length === 0) {
					return [];
				}

				return [
					{
						page: figma.currentPage,
						topLevelNodes: selection as SceneNode[],
					},
				];
			}

			default:
				return [];
		}
	}
}

export { VariableSearchService };
