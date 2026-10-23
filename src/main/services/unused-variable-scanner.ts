import { formatDuration, logger } from '../../shared/logger';
import type {
	SearchNotifier,
	UnusedDeleteErrorCode,
	UnusedDeleteResult,
	UnusedScanResult,
	UnusedVariable,
	VariableResolvedType,
} from '../../shared/rpc-types';
import { SCOPE_ALL_PAGES } from '../../shared/constants';
import { buildChildrenMap } from '../../shared/unused-tree';
import {
	collectPrototypeVariableIds,
	collectVariableIds,
	forEachNestedBinding,
} from './binding-extractor';
import { findNodesWithBindingsAsync, mayHaveBindings } from './node-traverser';
import { resolveSearchTargets } from './search-target-resolver';
import { findUnusedVariables, type GraphCollection, type GraphVariable } from './variable-graph';
import { acquireTraversalMode } from './traversal-mode';

const VERSION_TITLE = 'Before FindMyVar cleanup';
const STALE_MESSAGE = 'The file changed since the scan. Rescan before deleting.';

function failure(
	code: UnusedDeleteErrorCode,
	message: string,
	partial: Partial<UnusedDeleteResult> = {},
): UnusedDeleteResult {
	return {
		deletedIds: [],
		skippedIds: [],
		versionSaved: false,
		...partial,
		error: { code, message },
	};
}

type WithBoundVariables = { boundVariables?: unknown };
type WithReactions = { reactions?: ReadonlyArray<unknown> };

function hasReactions(node: SceneNode): boolean {
	const reactions = (node as WithReactions).reactions;
	return Array.isArray(reactions) && reactions.length > 0;
}

/** Layers whose variables matter: bound to a property, or used in a prototype interaction. */
function usesVariables(node: SceneNode): boolean {
	return mayHaveBindings(node) || hasReactions(node);
}

/** Adds every variable a layer uses, in its properties, paints, component properties or prototype. */
function collectNodeVariableIds(node: SceneNode, out: Set<string>): void {
	collectVariableIds((node as WithBoundVariables).boundVariables, out);
	forEachNestedBinding(node, (_field, variableId) => out.add(variableId));
	collectPrototypeVariableIds((node as WithReactions).reactions, out);
}

function collectStyleVariableIds(style: BaseStyle, out: Set<string>): void {
	const { paints, effects, layoutGrids, animationEntries, boundVariables } = style as Partial<
		Record<
			'paints' | 'effects' | 'layoutGrids' | 'animationEntries' | 'boundVariables',
			unknown
		>
	>;
	collectVariableIds(paints, out);
	collectVariableIds(effects, out);
	collectVariableIds(layoutGrids, out);
	collectVariableIds(animationEntries, out);
	collectVariableIds(boundVariables, out);
}

function collectSubtreeVariableIds(node: SceneNode, out: Set<string>, visited: Set<string>): void {
	if (visited.has(node.id) || node.removed) return;
	visited.add(node.id);
	collectNodeVariableIds(node, out);
	if ('children' in node) {
		for (const child of node.children) collectSubtreeVariableIds(child, out, visited);
	}
}

// Moving, renaming or locking a layer never changes its variables. Dragging fires these constantly.
// `parent` is not in here: a layer moved into a part the scan already walked must still be counted.
const NON_BINDABLE_PROPERTIES = new Set<string>([
	'x',
	'y',
	'relativeTransform',
	'rotation',
	'name',
	'pluginData',
	'locked',
	'expanded',
]);

/** Changes that bring a whole subtree of layers, with their variables. */
function bringsLayers(change: DocumentChange): boolean {
	return (
		change.type === 'CREATE' ||
		(change.type === 'PROPERTY_CHANGE' && change.properties.includes('parent'))
	);
}

/**
 * Variables that the changed layers and styles now use. Deleting a layer or style is skipped: it can
 * only make variables unused, so it never makes deleting unsafe. Throws if a change can't be read.
 */
function collectChangedVariableIds(changes: readonly DocumentChange[]): Set<string> {
	const ids = new Set<string>();
	const visited = new Set<string>();

	for (const change of changes) {
		try {
			if (bringsLayers(change)) {
				// A pasted, duplicated or moved layer brings its children, with their variables.
				collectSubtreeVariableIds((change as NodeChange).node as SceneNode, ids, visited);
			} else if (change.type === 'PROPERTY_CHANGE') {
				if (
					!change.node.removed &&
					!visited.has(change.node.id) &&
					change.properties.some((property) => !NON_BINDABLE_PROPERTIES.has(property))
				) {
					visited.add(change.node.id);
					collectNodeVariableIds(change.node as SceneNode, ids);
				}
			} else if (change.type === 'STYLE_CREATE' || change.type === 'STYLE_PROPERTY_CHANGE') {
				if (change.style) collectStyleVariableIds(change.style, ids);
			}
		} catch (error) {
			// A layer deleted right after it changed can't be read, and no longer uses anything.
			if ('node' in change && change.node.removed) continue;
			throw error;
		}
	}
	return ids;
}

interface Analysis {
	variables: Variable[];
	unused: UnusedVariable[];
	publishedNames: string[];
	totalVariables: number;
}

class UnusedVariableScanner {
	private activeScanId: string | null = null;
	private notifier: SearchNotifier;
	/** Variables bound to layers or styles in the last completed scan, plus any bound since. */
	private lastDirectlyUsedIds: Set<string> | null = null;
	/** Variables the last completed scan reported as unused. */
	private lastUnusedIds: Set<string> = new Set();
	/**
	 * What the scan in progress has found so far. Changes are added too, because the scan may have
	 * walked past the layer that changed.
	 */
	private scanUsedIds: Set<string> | null = null;
	/** A change during the scan in progress couldn't be read, so its result can't be trusted. */
	private scanMissedChange: boolean = false;
	private lastScanId: string | null = null;
	private isStale: boolean = false;
	private isTrackingChanges: boolean = false;
	private isDeleting: boolean = false;

	constructor(notifier: SearchNotifier) {
		this.notifier = notifier;
	}

	cancelScan(): void {
		if (this.activeScanId) {
			logger.log('[UnusedScan] Cancelled');
			this.activeScanId = null;
		}
	}

	async scan(scanId: string): Promise<void> {
		this.activeScanId = scanId;
		const startTime = Date.now();
		const signal = { cancelled: false };
		// Hidden layers inside instances still count as usage. Skipping them would report variables
		// as unused when they are not.
		const releaseTraversalMode = acquireTraversalMode('full');
		const directlyUsedIds = new Set<string>();

		try {
			// Loads all pages, which Figma requires before listening for document changes.
			const targets = await resolveSearchTargets(SCOPE_ALL_PAGES);
			this.scanUsedIds = directlyUsedIds;
			this.scanMissedChange = false;
			this.startTrackingChanges();

			await this.collectStyleBindings(directlyUsedIds);

			const total = targets.reduce((sum, t) => sum + t.topLevelNodes.length, 0);
			let processed = 0;

			for (let pageIndex = 0; pageIndex < targets.length; pageIndex++) {
				const { page, topLevelNodes } = targets[pageIndex];
				const progress = {
					scanId,
					total,
					currentPage: page.name,
					pageIndex,
					pageCount: targets.length,
				};
				this.notifier.notify('unusedScan.progress', { ...progress, processed });

				for (const topNode of topLevelNodes) {
					if (!this.isActiveScan(scanId)) {
						signal.cancelled = true;
						return;
					}

					for await (const node of findNodesWithBindingsAsync(
						topNode,
						signal,
						usesVariables,
					)) {
						if (!this.isActiveScan(scanId)) {
							signal.cancelled = true;
							return;
						}
						collectNodeVariableIds(node, directlyUsedIds);
					}

					processed++;
					this.notifier.notify('unusedScan.progress', { ...progress, processed });
				}
			}

			// Changes keep arriving while the analysis waits on Figma, and land in `directlyUsedIds`.
			const usedBeforeAnalysis = new Set(directlyUsedIds);
			const analysis = await this.analyze(directlyUsedIds);
			if (!this.isActiveScan(scanId)) return;

			this.lastDirectlyUsedIds = directlyUsedIds;
			this.lastUnusedIds = new Set(analysis.unused.map((v) => v.id));
			this.lastScanId = scanId;
			this.isStale = false;

			const result: UnusedScanResult = {
				totalVariables: analysis.totalVariables,
				unused: analysis.unused,
				publishedNames: analysis.publishedNames,
			};
			this.notifier.notify('unusedScan.complete', { scanId, result });

			const boundDuringAnalysis = Array.from(directlyUsedIds).some(
				(id) => !usedBeforeAnalysis.has(id) && this.lastUnusedIds.has(id),
			);
			if (boundDuringAnalysis || this.scanMissedChange) this.markStale();

			logger.log(
				`[UnusedScan] Done: ${analysis.unused.length}/${analysis.totalVariables} unused in ${formatDuration(Date.now() - startTime)}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.notifier.notify('unusedScan.error', { scanId, error: message });
		} finally {
			releaseTraversalMode();
			if (this.scanUsedIds === directlyUsedIds) {
				this.scanUsedIds = null;
			}
			if (this.activeScanId === scanId) {
				this.activeScanId = null;
			}
		}
	}

	/**
	 * Deletes exactly `ids`, from the result of scan `scanId`. A version is saved first, and everything
	 * is checked again against the current file right before removing. Refusals come back as an
	 * `error` with a code, not as a thrown error.
	 */
	async deleteVariables(scanId: string, ids: string[]): Promise<UnusedDeleteResult> {
		if (this.isDeleting || this.activeScanId) {
			return failure('BUSY', 'Wait for the current scan or delete to finish.');
		}
		if (!this.lastDirectlyUsedIds) {
			return failure('NOT_SCANNED', 'Scan the file before deleting.');
		}
		if (scanId !== this.lastScanId || this.isStale) {
			return failure('STALE', STALE_MESSAGE);
		}

		this.isDeleting = true;
		try {
			return await this.deleteChecked(ids);
		} finally {
			this.isDeleting = false;
		}
	}

	private async deleteChecked(ids: string[]): Promise<UnusedDeleteResult> {
		const first = await this.planDeletion(ids);
		if (first.isStale) this.markStale();
		if (this.isStale) return failure('STALE', STALE_MESSAGE);
		if (first.toDelete.length === 0) {
			return { deletedIds: [], skippedIds: first.skippedIds, versionSaved: false };
		}

		try {
			await figma.saveVersionHistoryAsync(
				VERSION_TITLE,
				`FindMyVar is about to delete ${first.toDelete.length} unused variables.`,
			);
		} catch {
			return failure(
				'VERSION_FAILED',
				"Couldn't save a version first, so nothing was deleted.",
			);
		}

		// Someone may have used a variable while the version saved. Check again, then remove with no
		// awaits in between, so nothing can change after this last check.
		const { toDelete, skippedIds, children, variables, isStale } = await this.planDeletion(ids);
		// Also catches variables created after the scan, which the stale notice doesn't watch.
		if (isStale || toDelete.some((id) => this.lastDirectlyUsedIds!.has(id))) this.markStale();
		if (this.isStale) return failure('STALE', STALE_MESSAGE, { versionSaved: true });

		const byId = new Map(variables.map((v) => [v.id, v]));
		// Delete the variables that point to others first, so no alias is left dangling in between.
		const ordered = this.dependentsFirst(toDelete, children);

		const deletedIds: string[] = [];
		figma.commitUndo();
		try {
			for (const id of ordered) {
				const variable = byId.get(id);
				if (variable) {
					variable.remove();
					deletedIds.push(id);
				}
			}
		} catch (error) {
			// The results no longer match the file, so they can't be used for another delete.
			this.markStale();
			const reason = error instanceof Error ? error.message : 'Unknown error';
			return failure(
				'PARTIAL',
				`Deleted ${deletedIds.length} of ${ordered.length} variables, then stopped: ${reason}`,
				{ deletedIds, skippedIds, versionSaved: true },
			);
		} finally {
			figma.commitUndo();
		}

		logger.log(`[UnusedScan] Deleted ${deletedIds.length} variables`);
		return { deletedIds, skippedIds, versionSaved: true };
	}

	/**
	 * Splits `ids` into the ones still unused and the ones in use now. `isStale` means an unused
	 * variable that wasn't requested points to a requested one: deleting would break that alias, and
	 * the request didn't include it because aliases changed after the scan.
	 */
	private async planDeletion(ids: string[]): Promise<{
		toDelete: string[];
		skippedIds: string[];
		children: Map<string, string[]>;
		variables: Variable[];
		isStale: boolean;
	}> {
		const fresh = await this.analyze(this.lastDirectlyUsedIds!);
		const deletable = new Set(fresh.unused.map((v) => v.id));
		const requested = new Set(ids);
		const children = buildChildrenMap(fresh.unused);
		const toDelete = ids.filter((id) => deletable.has(id));
		const isStale = toDelete.some((id) =>
			(children.get(id) ?? []).some((child) => !requested.has(child)),
		);
		return {
			toDelete,
			skippedIds: ids.filter((id) => !deletable.has(id)),
			children,
			variables: fresh.variables,
			isStale,
		};
	}

	private markStale(): void {
		if (!this.lastScanId || this.isStale) return;
		this.isStale = true;
		this.notifier.notify('unusedScan.stale', { scanId: this.lastScanId });
	}

	private isActiveScan(scanId: string): boolean {
		return this.activeScanId === scanId;
	}

	private dependentsFirst(ids: string[], dependents: Map<string, string[]>): string[] {
		const remaining = new Set(ids);
		const ordered: string[] = [];
		while (remaining.size > 0) {
			const ready = Array.from(remaining).filter((id) =>
				(dependents.get(id) ?? []).every((d) => !remaining.has(d)),
			);
			// Aliases can't form cycles in Figma, but never loop forever if they somehow do.
			const batch = ready.length > 0 ? ready : Array.from(remaining);
			batch.forEach((id) => {
				remaining.delete(id);
				ordered.push(id);
			});
		}
		return ordered;
	}

	private async analyze(directlyUsedIds: Set<string>): Promise<Analysis> {
		const [variables, collections] = await Promise.all([
			figma.variables.getLocalVariablesAsync(),
			figma.variables.getLocalVariableCollectionsAsync(),
		]);

		const graphVariables: GraphVariable[] = variables.map((v) => ({
			id: v.id,
			name: v.name,
			resolvedType: v.resolvedType as VariableResolvedType,
			variableCollectionId: v.variableCollectionId,
			valuesByMode: v.valuesByMode,
		}));
		const graphCollections: GraphCollection[] = collections.map((c) => ({
			id: c.id,
			name: c.name,
			modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
			defaultModeId: c.defaultModeId,
			isExtension: c.isExtension,
			variableOverrides: c.isExtension
				? (c as unknown as ExtendedVariableCollection).variableOverrides
				: undefined,
		}));

		const candidates = findUnusedVariables(graphVariables, graphCollections, directlyUsedIds);
		const publishedIds = await this.findPublished(candidates, variables);

		if (publishedIds.size === 0) {
			return {
				variables,
				unused: candidates,
				publishedNames: [],
				totalVariables: variables.length,
			};
		}

		// Published variables may be used in other files. Treat them as used, so they are never
		// offered for deletion and the variables they point to are kept too.
		const usedOrPublished = new Set(directlyUsedIds);
		publishedIds.forEach((id) => usedOrPublished.add(id));
		const unused = findUnusedVariables(graphVariables, graphCollections, usedOrPublished);

		return {
			variables,
			unused,
			publishedNames: candidates.filter((v) => publishedIds.has(v.id)).map((v) => v.name),
			totalVariables: variables.length,
		};
	}

	private async findPublished(
		candidates: UnusedVariable[],
		variables: Variable[],
	): Promise<Set<string>> {
		const byId = new Map(variables.map((v) => [v.id, v]));
		const published = new Set<string>();

		await Promise.all(
			candidates.map(async ({ id }) => {
				const variable = byId.get(id);
				if (!variable || variable.hiddenFromPublishing) return;
				try {
					const status = await variable.getPublishStatusAsync();
					if (status !== 'UNPUBLISHED') published.add(id);
				} catch {
					// If we can't tell, keep it safe and treat it as published.
					published.add(id);
				}
			}),
		);
		return published;
	}

	private startTrackingChanges(): void {
		if (this.isTrackingChanges) return;
		this.isTrackingChanges = true;

		figma.on('documentchange', (event: DocumentChangeEvent) =>
			this.handleDocumentChange(event),
		);
	}

	private handleDocumentChange(event: DocumentChangeEvent): void {
		// Pasted or moved layers are walked like the scan walks them: hidden layers in instances count.
		const releaseTraversalMode = event.documentChanges.some(bringsLayers)
			? acquireTraversalMode('full')
			: null;

		let usedIds: Set<string>;
		try {
			usedIds = collectChangedVariableIds(event.documentChanges);
		} catch (error) {
			// We can't tell what the change uses, so results that may miss it can't be trusted.
			logger.warn('[UnusedScan] Could not read a change', error);
			if (this.scanUsedIds) this.scanMissedChange = true;
			this.markStale();
			return;
		} finally {
			releaseTraversalMode?.();
		}

		usedIds.forEach((id) => {
			this.scanUsedIds?.add(id);
			// Deleting re-checks against these, so a missed stale notice still can't delete them.
			this.lastDirectlyUsedIds?.add(id);
		});
		if (Array.from(usedIds).some((id) => this.lastUnusedIds.has(id))) this.markStale();
	}

	private async collectStyleBindings(out: Set<string>): Promise<void> {
		const styleLists = await Promise.all([
			figma.getLocalPaintStylesAsync(),
			figma.getLocalTextStylesAsync(),
			figma.getLocalEffectStylesAsync(),
			figma.getLocalGridStylesAsync(),
			// Figma versions without Motion don't have animation styles.
			typeof figma.getLocalCustomAnimationStylesAsync === 'function'
				? figma.getLocalCustomAnimationStylesAsync()
				: [],
		]);

		for (const style of styleLists.flat()) {
			collectStyleVariableIds(style, out);
		}
	}
}

export { UnusedVariableScanner };
