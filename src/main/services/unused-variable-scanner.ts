import { formatDuration, logger } from '../../shared/logger';
import type {
	SearchNotifier,
	UnusedDeleteResult,
	UnusedScanResult,
	UnusedVariable,
	VariableResolvedType,
} from '../../shared/rpc-types';
import { SCOPE_ALL_PAGES } from '../../shared/constants';
import { buildChildrenMap, expandWithDescendants } from '../../shared/unused-tree';
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

interface Analysis {
	unused: UnusedVariable[];
	publishedNames: string[];
	totalVariables: number;
}

class UnusedVariableScanner {
	private activeScanId: string | null = null;
	private notifier: SearchNotifier;
	/** Variables bound to layers or styles in the last completed scan. */
	private lastDirectlyUsedIds: Set<string> | null = null;
	private lastScanId: string | null = null;
	private isStale: boolean = false;
	private isDeleting: boolean = false;
	private isTrackingChanges: boolean = false;

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

		try {
			const directlyUsedIds = new Set<string>();
			await this.collectStyleBindings(directlyUsedIds);

			const targets = await resolveSearchTargets(SCOPE_ALL_PAGES);
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
						collectVariableIds(
							(node as WithBoundVariables).boundVariables,
							directlyUsedIds,
						);
						forEachNestedBinding(node, (_field, variableId) =>
							directlyUsedIds.add(variableId),
						);
						collectPrototypeVariableIds(
							(node as WithReactions).reactions,
							directlyUsedIds,
						);
					}

					processed++;
					this.notifier.notify('unusedScan.progress', { ...progress, processed });
				}
			}

			const analysis = await this.analyze(directlyUsedIds);
			if (!this.isActiveScan(scanId)) return;

			this.lastDirectlyUsedIds = directlyUsedIds;
			this.lastScanId = scanId;
			this.isStale = false;
			this.startTrackingChanges();

			const result: UnusedScanResult = {
				totalVariables: analysis.totalVariables,
				unused: analysis.unused,
				publishedNames: analysis.publishedNames,
			};
			this.notifier.notify('unusedScan.complete', { scanId, result });

			logger.log(
				`[UnusedScan] Done: ${analysis.unused.length}/${analysis.totalVariables} unused in ${formatDuration(Date.now() - startTime)}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.notifier.notify('unusedScan.error', { scanId, error: message });
		} finally {
			releaseTraversalMode();
			if (this.activeScanId === scanId) {
				this.activeScanId = null;
			}
		}
	}

	/**
	 * Deletes the given variables together with the unused variables that point to them. Everything is
	 * checked again against the current variables first, and a version is saved before anything changes.
	 */
	async deleteVariables(ids: string[]): Promise<UnusedDeleteResult> {
		if (!this.lastDirectlyUsedIds) {
			throw new Error('Scan the file before deleting.');
		}
		if (this.isStale) {
			throw new Error('The file changed since the scan. Rescan before deleting.');
		}

		const fresh = await this.analyze(this.lastDirectlyUsedIds);
		const deletable = new Set(fresh.unused.map((v) => v.id));
		const children = buildChildrenMap(fresh.unused);
		const toDelete = expandWithDescendants(
			ids.filter((id) => deletable.has(id)),
			children,
		);

		if (toDelete.length === 0) {
			return { deletedIds: [], versionSaved: false };
		}

		try {
			await figma.saveVersionHistoryAsync(
				VERSION_TITLE,
				`FindMyVar is about to delete ${toDelete.length} unused variables.`,
			);
		} catch {
			throw new Error("Couldn't save a version first, so nothing was deleted.");
		}

		// Delete the variables that point to others first, so no alias is left dangling in between.
		const ordered = this.dependentsFirst(toDelete, children);

		const deletedIds: string[] = [];
		this.isDeleting = true;
		try {
			figma.commitUndo();
			for (const id of ordered) {
				const variable = await figma.variables.getVariableByIdAsync(id);
				if (variable) {
					variable.remove();
					deletedIds.push(id);
				}
			}
			figma.commitUndo();
		} finally {
			this.isDeleting = false;
		}

		logger.log(`[UnusedScan] Deleted ${deletedIds.length} variables`);
		return { deletedIds, versionSaved: true };
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
			return { unused: candidates, publishedNames: [], totalVariables: variables.length };
		}

		// Published variables may be used in other files. Treat them as used, so they are never
		// offered for deletion and the variables they point to are kept too.
		const usedOrPublished = new Set(directlyUsedIds);
		publishedIds.forEach((id) => usedOrPublished.add(id));
		const unused = findUnusedVariables(graphVariables, graphCollections, usedOrPublished);

		return {
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

		figma.on('documentchange', (event: DocumentChangeEvent) => {
			if (!this.lastScanId || this.isStale || this.isDeleting) return;

			const relevant = event.documentChanges.some(
				(change) =>
					change.type === 'CREATE' ||
					change.type === 'DELETE' ||
					change.type === 'STYLE_CREATE' ||
					change.type === 'STYLE_DELETE' ||
					change.type === 'STYLE_PROPERTY_CHANGE' ||
					(change.type === 'PROPERTY_CHANGE' &&
						(change.properties as string[]).some(
							(property) => property === 'boundVariables' || property === 'reactions',
						)),
			);
			if (!relevant) return;

			this.isStale = true;
			this.notifier.notify('unusedScan.stale', { scanId: this.lastScanId });
		});
	}

	private async collectStyleBindings(out: Set<string>): Promise<void> {
		const [paintStyles, textStyles, effectStyles, gridStyles] = await Promise.all([
			figma.getLocalPaintStylesAsync(),
			figma.getLocalTextStylesAsync(),
			figma.getLocalEffectStylesAsync(),
			figma.getLocalGridStylesAsync(),
		]);

		for (const style of paintStyles) {
			collectVariableIds(style.paints, out);
			collectVariableIds((style as WithBoundVariables).boundVariables, out);
		}
		for (const style of textStyles) {
			collectVariableIds((style as WithBoundVariables).boundVariables, out);
		}
		for (const style of effectStyles) {
			collectVariableIds(style.effects, out);
			collectVariableIds((style as WithBoundVariables).boundVariables, out);
		}
		for (const style of gridStyles) {
			collectVariableIds(style.layoutGrids, out);
			collectVariableIds((style as WithBoundVariables).boundVariables, out);
		}
	}
}

export { UnusedVariableScanner };
