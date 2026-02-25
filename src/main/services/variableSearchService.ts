import { SearchScope, VariableUsage } from '../../shared/rpc-types';
import { formatDuration, logger } from '../lib/logger';
import { rpcServer } from '../lib/rpc-server';

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
const NODE_THRESHOLD_FOR_RECURSION = 100;

class VariableSearchService {
	private cache: Map<string, CacheEntry> = new Map();
	private documentChangeCount: number = 0;
	private activeSearchId: string | null = null;
	private isInitialized: boolean = false;

	init(): void {
		if (this.isInitialized) return;

		figma.on('documentchange', (event: DocumentChangeEvent) => {
			this.handleDocumentChange(event);
		});

		this.isInitialized = true;
		logger.log('[VariableSearch] Initialized');
	}

	clearCache(variableId?: string): void {
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

	async search(variableId: string, scope: SearchScope): Promise<void> {
		const searchId = `${variableId}-${Date.now()}`;
		this.activeSearchId = searchId;
		const startTime = Date.now();

		const cacheKey = this.getCacheKey(variableId, scope);
		const cached = this.cache.get(cacheKey);

		if (cached && this.isCacheValid(cached)) {
			logger.log(
				`[VariableSearch] Cache hit: ${cached.results.length} results (${formatDuration(Date.now() - startTime)})`,
			);

			rpcServer.notify('variableSearch.results', {
				results: cached.results,
				isComplete: true,
			});

			this.activeSearchId = null;
			return;
		}

		if (scope === 'selection' && figma.currentPage.selection.length === 0) {
			rpcServer.notify('variableSearch.results', {
				results: [],
				isComplete: true,
			});

			rpcServer.notify('variableSearch.progress', {
				processed: 0,
				total: 0,
				currentPage: 'No selection',
			});

			this.activeSearchId = null;
			return;
		}

		const signal = { cancelled: false };

		try {
			figma.skipInvisibleInstanceChildren = true;

			const allResults: VariableUsage[] = [];
			const targets = await this.getSearchTargets(scope);

			const totalTopLevelNodes = targets.reduce((sum, t) => sum + t.topLevelNodes.length, 0);

			let processedTopLevelNodes = 0;
			let pendingResults: VariableUsage[] = [];

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

					const nodes = await this.findNodesWithBindingsChunked(topNode, signal);
					processedTopLevelNodes++;

					for (const node of nodes) {
						const fields = this.getVariableBindings(node, variableId);

						if (fields) {
							for (const field of fields) {
								const usage: VariableUsage = {
									nodeId: node.id,
									nodeName: node.name,
									nodeType: node.type,
									field,
									pageName,
									pageId,
									nodePath: this.buildNodePath(node),
								};
								allResults.push(usage);
								pendingResults.push(usage);
							}
						}
					}

					if (pendingResults.length >= RESULTS_BATCH_SIZE) {
						rpcServer.notify('variableSearch.results', {
							results: pendingResults,
							isComplete: false,
						});
						pendingResults = [];
					}

					rpcServer.notify('variableSearch.progress', {
						processed: processedTopLevelNodes,
						total: totalTopLevelNodes,
						currentPage: pageName,
					});

					await this.yieldToMain();
				}
			}

			if (pendingResults.length > 0) {
				rpcServer.notify('variableSearch.results', {
					results: pendingResults,
					isComplete: false,
				});
			}

			rpcServer.notify('variableSearch.results', {
				results: [],
				isComplete: true,
			});

			rpcServer.notify('variableSearch.progress', {
				processed: totalTopLevelNodes,
				total: totalTopLevelNodes,
				currentPage: 'Complete',
			});

			this.cache.set(cacheKey, {
				variableId,
				scope,
				results: allResults,
				timestamp: Date.now(),
				documentChangeCount: this.documentChangeCount,
				selectionKey: scope === 'selection' ? this.getSelectionKey() : undefined,
			});

			logger.log(
				`[VariableSearch] Done: ${allResults.length} results in ${formatDuration(Date.now() - startTime)}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			rpcServer.notify('variableSearch.error', { error: message });
		} finally {
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

	private findNodesWithBindingsSync(node: SceneNode): SceneNode[] {
		if ('findAll' in node && typeof node.findAll === 'function') {
			return node.findAll(this.hasBoundVariables) as SceneNode[];
		}
		return this.hasBoundVariables(node) ? [node] : [];
	}

	private async findNodesWithBindingsChunked(
		node: SceneNode,
		signal: { cancelled: boolean },
	): Promise<SceneNode[]> {
		if (signal.cancelled) return [];

		if ('children' in node && node.children.length > NODE_THRESHOLD_FOR_RECURSION) {
			const results: SceneNode[] = [];

			if (this.hasBoundVariables(node)) {
				results.push(node);
			}

			for (const child of node.children) {
				if (signal.cancelled) break;
				const childResults = await this.findNodesWithBindingsChunked(
					child as SceneNode,
					signal,
				);
				results.push(...childResults);
				await this.yieldToMain();
			}

			return results;
		}

		return this.findNodesWithBindingsSync(node);
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

		if (relevantChange) {
			this.documentChangeCount++;
		}
	}

	private isCacheValid(entry: CacheEntry): boolean {
		const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
		const isStale = entry.documentChangeCount !== this.documentChangeCount;

		if (isExpired || isStale) return false;

		if (entry.scope === 'selection') {
			return entry.selectionKey === this.getSelectionKey();
		}

		if (entry.scope === 'current-page') {
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
		if (scope === 'selection') {
			const selectionKey = this.getSelectionKey();
			return `${variableId}:${scope}:${selectionKey}`;
		}

		if (scope === 'current-page') {
			return `${variableId}:${scope}:${figma.currentPage.id}`;
		}

		return `${variableId}:${scope}`;
	}

	private buildNodePath(node: SceneNode): string {
		const parent = node.parent;
		if (!parent) {
			return '';
		}

		const path: BaseNode[] = [];
		let current: BaseNode | null = parent;

		while (current && current.type !== 'PAGE') {
			path.unshift(current);
			current = current.parent;
		}

		if (path.length < 2) {
			return '';
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
			return '';
		}

		return `${highestName}/.../${parentName}`;
	}

	private async getSearchTargets(scope: SearchScope): Promise<SearchTarget[]> {
		await figma.loadAllPagesAsync();

		switch (scope) {
			case 'all-pages':
				return figma.root.children.map((page) => ({
					page,
					topLevelNodes: page.children as SceneNode[],
				}));

			case 'current-page':
				return [
					{
						page: figma.currentPage,
						topLevelNodes: figma.currentPage.children as SceneNode[],
					},
				];

			case 'selection': {
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

export const variableSearchService = new VariableSearchService();
