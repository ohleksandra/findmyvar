import { VariableUsage } from '../../shared/rpc-types';
import { rpcServer } from '../lib/rpc-server';

interface CacheEntry {
	variableId: string;
	timestamp: number;
	results: VariableUsage[];
	documentChangeCount: number;
}

const YIELD_INTERVAL = 16;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
		console.log('[VariableSearch] Service initialized');
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
			console.log(`[VariableSearch] Cancelled: ${this.activeSearchId}`);
			this.activeSearchId = null;
		}
	}

	async search(variableId: string): Promise<void> {
		const searchId = `${variableId}-${Date.now()}`;
		this.activeSearchId = searchId;

		const cached = this.cache.get(variableId);
		if (cached && this.isCacheValid(cached)) {
			console.log(`[VariableSearch] Cache hit: ${cached.results.length} results`);

			rpcServer.notify('variableSearch.results', {
				results: cached.results,
				isComplete: true,
			});

			this.activeSearchId = null;
			return;
		}

		try {
			figma.skipInvisibleInstanceChildren = true;

			const allResults: VariableUsage[] = [];
			await figma.loadAllPagesAsync();
			const pages = figma.root.children;

			const pageData: Array<{ page: PageNode; nodes: readonly SceneNode[] }> = [];
			let totalNodes = 0;

			for (const page of pages) {
				if (this.activeSearchId !== searchId) return;

				const nodes = page.findAll();
				totalNodes += nodes.length;
				pageData.push({ page, nodes });
			}

			console.log(`[VariableSearch] Total nodes: ${totalNodes}`);

			let processedNodes = 0;
			let lastYieldTime = Date.now();
			let pendingResults: VariableUsage[] = [];

			for (const { page, nodes } of pageData) {
				if (this.activeSearchId !== searchId) return;

				const pageId = page.id;
				const pageName = page.name;

				for (let i = 0; i < nodes.length; i++) {
					const node = nodes[i];
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
							};
							allResults.push(usage);
							pendingResults.push(usage);
						}
					}

					processedNodes++;

					const now = Date.now();
					if (now - lastYieldTime >= YIELD_INTERVAL) {
						// Send pending results
						if (pendingResults.length > 0) {
							rpcServer.notify('variableSearch.results', {
								results: pendingResults,
								isComplete: false,
							});
							pendingResults = [];
						}

						rpcServer.notify('variableSearch.progress', {
							processed: processedNodes,
							total: totalNodes,
							currentPage: pageName,
						});

						await this.yieldToMain();
						lastYieldTime = Date.now();

						if (this.activeSearchId !== searchId) {
							console.log('[VariableSearch] Cancelled after yield');
							return;
						}
					}
				}
			}

			if (pendingResults.length > 0) {
				rpcServer.notify('variableSearch.results', {
					results: pendingResults,
					isComplete: false,
				});
			}

			// Complete
			rpcServer.notify('variableSearch.results', {
				results: [],
				isComplete: true,
			});

			rpcServer.notify('variableSearch.progress', {
				processed: totalNodes,
				total: totalNodes,
				currentPage: 'Complete',
			});

			this.cache.set(variableId, {
				variableId,
				results: allResults,
				timestamp: Date.now(),
				documentChangeCount: this.documentChangeCount,
			});

			console.log(`[VariableSearch] Done. Found ${allResults.length} usages`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			rpcServer.notify('variableSearch.error', { error: message });
		} finally {
			if (this.activeSearchId === searchId) {
				this.activeSearchId = null;
			}
		}
	}

	private handleDocumentChange(event: DocumentChangeEvent): void {
		const relevantChange = event.documentChanges.some((change) => {
			return (
				change.type === 'CREATE' ||
				change.type === 'DELETE' ||
				(change.type === 'PROPERTY_CHANGE' && change.properties.includes('boundVariables'))
			);
		});

		if (relevantChange) {
			this.documentChangeCount++;
			console.log(
				`[VariableSearch] Document changed, invalidation counter: ${this.documentChangeCount}`,
			);
		}
	}

	private isCacheValid(entry: CacheEntry): boolean {
		const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
		const isStale = entry.documentChangeCount !== this.documentChangeCount;
		return !isExpired && !isStale;
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
}

export const variableSearchService = new VariableSearchService();
