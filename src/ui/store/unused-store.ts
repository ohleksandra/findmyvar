import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { callPlugin } from '@/lib/call-plugin';
import type {
	UnusedDeleteResult,
	UnusedScanProgress,
	UnusedScanResult,
} from '../../shared/rpc-types';
import { buildChildrenMap, descendantsOf } from '../../shared/unused-tree';
import { usePluginStore } from './plugin-store';

// Saving a version and re-checking every variable can take well over the default 30 seconds.
const DELETE_TIMEOUT_MS = 5 * 60 * 1000;

export type UnusedScanStatus = 'idle' | 'scanning' | 'done' | 'error';
export type UnusedDeleteStatus = 'idle' | 'confirming' | 'deleting' | 'done';

interface PreviousScan {
	result: UnusedScanResult;
	resultScanId: string | null;
	isStale: boolean;
	selectedIds: string[];
}

interface UnusedStore {
	/** Whether the "Unused variables" tab exists. */
	isOpen: boolean;
	/** Whether the "Unused variables" tab is the one being shown. */
	isActive: boolean;
	status: UnusedScanStatus;
	progress: UnusedScanProgress | null;
	result: UnusedScanResult | null;
	error: string | null;
	activeScanId: string | null;
	/** The scan `result` came from. Deletes name it, so they never run against a newer scan. */
	resultScanId: string | null;
	isStale: boolean;
	filter: string;
	selectedIds: string[];
	expandedId: string | null;
	deleteStatus: UnusedDeleteStatus;
	/** What the confirmation dialog is about to delete: the selection, or one variable and its dependents. */
	deleteTargetIds: string[];
	deleteError: string | null;
	deleteResult: UnusedDeleteResult | null;
	/** The finished scan shown before a rescan. Cancelling the rescan brings it back. */
	previousScan: PreviousScan | null;

	startScan(): Promise<void>;
	showSearch(): void;
	showUnused(): void;
	cancelScan(): Promise<void>;
	close(): Promise<void>;
	setFilter(filter: string): void;
	toggleSelected(id: string): void;
	selectMany(ids: string[]): void;
	clearSelection(): void;
	toggleExpanded(id: string): void;
	requestDelete(): void;
	requestDeleteOne(id: string): void;
	cancelDelete(): void;
	/** Resolves to whether the variables were deleted. */
	confirmDelete(extraIds?: string[]): Promise<boolean>;

	_setProgress(scanId: string, progress: UnusedScanProgress): void;
	_complete(scanId: string, result: UnusedScanResult): void;
	_setError(scanId: string, error: string): void;
	_setStale(): void;
}

const initialScanState = {
	status: 'idle' as UnusedScanStatus,
	progress: null,
	result: null,
	error: null,
	activeScanId: null,
	resultScanId: null,
	isStale: false,
	selectedIds: [],
	expandedId: null,
	deleteStatus: 'idle' as UnusedDeleteStatus,
	deleteTargetIds: [],
	deleteError: null,
	deleteResult: null,
	previousScan: null as PreviousScan | null,
};

async function cancelPluginScan(): Promise<void> {
	try {
		await callPlugin('unusedScan.cancel');
	} catch {
		// The UI stops listening to the scan anyway, so its results can't show up later.
	}
}

export const useUnusedStore = create<UnusedStore>()((set, get) => ({
	isOpen: false,
	isActive: false,
	filter: '',
	...initialScanState,

	startScan: async () => {
		if (usePluginStore.getState().isSearching) {
			await usePluginStore.getState().cancelSearch();
		}

		const state = get();
		let previousScan = state.status === 'scanning' ? state.previousScan : null;
		// A result whose variables were just deleted no longer matches the file, so it isn't kept.
		if (state.status === 'done' && state.deleteStatus !== 'done' && state.result) {
			const { result, resultScanId, isStale, selectedIds } = state;
			previousScan = { result, resultScanId, isStale, selectedIds };
		}

		const scanId = nanoid();
		set({
			...initialScanState,
			isOpen: true,
			isActive: true,
			status: 'scanning',
			activeScanId: scanId,
			previousScan,
		});

		try {
			await callPlugin('unusedScan.start', { scanId });
		} catch (err) {
			get()._setError(scanId, err instanceof Error ? err.message : 'Scan failed');
		}
	},

	cancelScan: async () => {
		const scanId = get().activeScanId;
		if (!scanId) return;
		await cancelPluginScan();
		// The scan may have finished or failed while cancelling. Then its outcome stays.
		if (get().activeScanId !== scanId) return;

		const { previousScan } = get();
		set(
			previousScan
				? {
						...previousScan,
						status: 'done',
						progress: null,
						activeScanId: null,
						previousScan: null,
					}
				: { status: 'idle', progress: null, activeScanId: null },
		);
	},

	close: async () => {
		const isScanning = get().status === 'scanning';
		// Close right away. A scan that finishes later has no active scan to land in.
		set({ ...initialScanState, isOpen: false, isActive: false, filter: '' });
		if (isScanning) await cancelPluginScan();
	},

	showSearch: () => set({ isActive: false }),

	showUnused: () => {
		if (get().isOpen) set({ isActive: true });
	},

	setFilter: (filter) => set({ filter }),

	toggleSelected: (id) => {
		const { result, selectedIds } = get();
		if (!result) return;
		// A variable always goes together with the unused variables that point to it.
		const group = [id, ...descendantsOf(id, buildChildrenMap(result.unused))];
		const selected = new Set(selectedIds);
		if (selected.has(id)) {
			group.forEach((g) => selected.delete(g));
		} else {
			group.forEach((g) => selected.add(g));
		}
		set({ selectedIds: Array.from(selected) });
	},

	selectMany: (ids) => {
		const { result, selectedIds } = get();
		if (!result) return;
		const children = buildChildrenMap(result.unused);
		const selected = new Set(selectedIds);
		ids.forEach((id) => {
			selected.add(id);
			descendantsOf(id, children).forEach((d) => selected.add(d));
		});
		set({ selectedIds: Array.from(selected) });
	},

	clearSelection: () => set({ selectedIds: [] }),

	toggleExpanded: (id) => set({ expandedId: get().expandedId === id ? null : id }),

	requestDelete: () => {
		const { isStale, selectedIds } = get();
		if (isStale || selectedIds.length === 0) return;
		set({ deleteStatus: 'confirming', deleteTargetIds: selectedIds, deleteError: null });
	},

	requestDeleteOne: (id) => {
		const { isStale, result } = get();
		if (isStale || !result) return;
		const targets = [id, ...descendantsOf(id, buildChildrenMap(result.unused))];
		set({ deleteStatus: 'confirming', deleteTargetIds: targets, deleteError: null });
	},

	cancelDelete: () => set({ deleteStatus: 'idle', deleteTargetIds: [], deleteError: null }),

	confirmDelete: async (extraIds = []) => {
		const { resultScanId, deleteTargetIds, deleteStatus } = get();
		if (!resultScanId || deleteStatus === 'deleting') return false;
		const ids = Array.from(new Set([...deleteTargetIds, ...extraIds]));
		set({ deleteStatus: 'deleting', deleteError: null });

		let deleteResult: UnusedDeleteResult;
		try {
			deleteResult = await callPlugin(
				'unusedScan.delete',
				{ scanId: resultScanId, ids },
				{ timeout: DELETE_TIMEOUT_MS },
			);
		} catch {
			// No answer, so the plugin may still be deleting. Retrying could act on a half-deleted file.
			set({
				deleteStatus: 'confirming',
				deleteError:
					"Couldn't confirm the delete, so some variables may already be gone. Scan again to see what's left.",
				isStale: true,
			});
			return false;
		}

		const deleted = new Set(deleteResult.deletedIds);
		const selectedIds = get().selectedIds.filter((id) => !deleted.has(id));
		if (deleted.size > 0) void usePluginStore.getState().getAllVariables();

		const { error } = deleteResult;
		if (error) {
			set({
				deleteStatus: 'confirming',
				deleteError:
					error.code === 'PARTIAL'
						? `${error.message}. Scan again to see what's left; Undo brings back the deleted ones.`
						: error.message,
				// After a partial delete the list no longer matches the file either.
				isStale: get().isStale || error.code === 'STALE' || error.code === 'PARTIAL',
				deleteTargetIds: get().deleteTargetIds.filter((id) => !deleted.has(id)),
				selectedIds,
			});
			return false;
		}

		set({
			deleteStatus: 'done',
			deleteResult,
			deleteTargetIds: [],
			selectedIds,
			expandedId: null,
		});
		return true;
	},

	_setProgress: (scanId, progress) => {
		if (get().activeScanId !== scanId) return;
		set({ progress });
	},

	_complete: (scanId, result) => {
		if (get().activeScanId !== scanId) return;
		set({
			status: 'done',
			result,
			activeScanId: null,
			resultScanId: scanId,
			isStale: false,
			previousScan: null,
		});
	},

	_setError: (scanId, error) => {
		if (get().activeScanId !== scanId) return;
		set({ status: 'error', error, activeScanId: null, previousScan: null });
	},

	_setStale: () => {
		const { status, previousScan } = get();
		if (status === 'done') {
			set({ isStale: true });
		} else if (previousScan) {
			// During a rescan the notice is about the previous scan, which Cancel brings back.
			set({ previousScan: { ...previousScan, isStale: true } });
		}
	},
}));
