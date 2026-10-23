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

export type UnusedScanStatus = 'idle' | 'scanning' | 'done' | 'error';
export type UnusedDeleteStatus = 'idle' | 'confirming' | 'deleting' | 'done';

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
	isStale: boolean;
	filter: string;
	selectedIds: string[];
	expandedId: string | null;
	deleteStatus: UnusedDeleteStatus;
	/** What the confirmation dialog is about to delete: the selection, or one variable and its dependents. */
	deleteTargetIds: string[];
	deleteError: string | null;
	deleteResult: UnusedDeleteResult | null;

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
	confirmDelete(extraIds?: string[]): Promise<void>;

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
	isStale: false,
	selectedIds: [],
	expandedId: null,
	deleteStatus: 'idle' as UnusedDeleteStatus,
	deleteTargetIds: [],
	deleteError: null,
	deleteResult: null,
};

export const useUnusedStore = create<UnusedStore>()((set, get) => ({
	isOpen: false,
	isActive: false,
	filter: '',
	...initialScanState,

	startScan: async () => {
		if (usePluginStore.getState().isSearching) {
			await usePluginStore.getState().cancelSearch();
		}

		const scanId = nanoid();
		set({
			...initialScanState,
			isOpen: true,
			isActive: true,
			status: 'scanning',
			activeScanId: scanId,
		});

		try {
			await callPlugin('unusedScan.start', { scanId });
		} catch (err) {
			get()._setError(scanId, err instanceof Error ? err.message : 'Scan failed');
		}
	},

	cancelScan: async () => {
		try {
			await callPlugin('unusedScan.cancel');
		} finally {
			set({ status: 'idle', progress: null, activeScanId: null });
		}
	},

	close: async () => {
		if (get().status === 'scanning') {
			await get().cancelScan();
		}
		set({ ...initialScanState, isOpen: false, isActive: false, filter: '' });
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
		const ids = Array.from(new Set([...get().deleteTargetIds, ...extraIds]));
		set({ deleteStatus: 'deleting', deleteError: null });

		try {
			const deleteResult = await callPlugin('unusedScan.delete', { ids });
			const deleted = new Set(deleteResult.deletedIds);
			set({
				deleteStatus: 'done',
				deleteResult,
				deleteTargetIds: [],
				selectedIds: get().selectedIds.filter((id) => !deleted.has(id)),
				expandedId: null,
			});
			void usePluginStore.getState().getAllVariables();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Delete failed';
			set({
				deleteStatus: 'confirming',
				deleteError: message,
				isStale: get().isStale || message.includes('changed since the scan'),
			});
		}
	},

	_setProgress: (scanId, progress) => {
		if (get().activeScanId !== scanId) return;
		set({ progress });
	},

	_complete: (scanId, result) => {
		if (get().activeScanId !== scanId) return;
		set({ status: 'done', result, activeScanId: null, isStale: false });
	},

	_setError: (scanId, error) => {
		if (get().activeScanId !== scanId) return;
		set({ status: 'error', error, activeScanId: null });
	},

	_setStale: () => {
		if (get().status === 'done') set({ isStale: true });
	},
}));
