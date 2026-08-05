import { SearchScope, VariableUsage } from '../../shared/rpc-types';
import { SCOPE_CURRENT_PAGE, SCOPE_SELECTION } from '../../shared/constants';

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 20;
const DOCUMENT_CHANGE_DEBOUNCE_MS = 500;

interface CacheEntry {
	variableId: string;
	timestamp: number;
	results: VariableUsage[];
	documentChangeCount: number;
	selectionKey?: string;
	scope: SearchScope;
}

class SearchCache {
	private cache: Map<string, CacheEntry> = new Map();
	private documentChangeCount: number = 0;
	private pendingChangeTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingChangeHasRelevant: boolean = false;

	startTracking(): void {
		figma.on('documentchange', (event: DocumentChangeEvent) => {
			this.handleDocumentChange(event);
		});
	}

	getDocumentChangeCount(): number {
		return this.documentChangeCount;
	}

	get(key: string): CacheEntry | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			this.cache.delete(key);
			this.cache.set(key, entry);
		}
		return entry;
	}

	set(key: string, entry: CacheEntry): void {
		if (this.cache.size >= MAX_CACHE_ENTRIES) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}
		this.cache.set(key, entry);
	}

	clear(variableId?: string): void {
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

	isValid(entry: CacheEntry): boolean {
		if (Date.now() - entry.timestamp > CACHE_TTL) return false;
		if (entry.documentChangeCount !== this.documentChangeCount) return false;

		if (entry.scope === SCOPE_SELECTION) {
			return entry.selectionKey === this.getSelectionKey();
		}

		if (entry.scope === SCOPE_CURRENT_PAGE) {
			const currentCacheKey = this.keyFor(entry.variableId, entry.scope);
			const entryCacheKey = `${entry.variableId}:${entry.scope}:${figma.currentPage.id}`;
			return currentCacheKey === entryCacheKey;
		}

		return true;
	}

	keyFor(variableId: string, scope: SearchScope): string {
		if (scope === SCOPE_SELECTION) {
			return `${variableId}:${scope}:${this.getSelectionKey()}`;
		}

		if (scope === SCOPE_CURRENT_PAGE) {
			return `${variableId}:${scope}:${figma.currentPage.id}`;
		}

		return `${variableId}:${scope}`;
	}

	getSelectionKey(): string {
		const selection = figma.currentPage.selection;
		if (selection.length === 0) return 'empty';
		return selection
			.map((node) => node.id)
			.sort()
			.join(',');
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
}

export { SearchCache, type CacheEntry };
