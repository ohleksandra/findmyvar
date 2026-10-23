import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { UnusedScanResult, UnusedVariable } from '../src/shared/rpc-types';

const mockCallPlugin = vi.fn();

vi.mock('../src/ui/lib/call-plugin', () => ({
	callPlugin: (...args: unknown[]) => mockCallPlugin(...args),
	rpcClient: { on: vi.fn(() => vi.fn()) },
}));

vi.mock('../src/shared/logger', () => ({
	logger: { log: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
	formatDuration: (ms: number) => `${ms}ms`,
}));

function unused(id: string, usedBy: string[] = [], parentId: string | null = null): UnusedVariable {
	return {
		id,
		name: id,
		resolvedType: 'COLOR',
		collectionId: 'c',
		collectionName: 'Semantic',
		isPalette: false,
		parentId,
		usedBy: usedBy.map((u) => ({ id: u, name: u })),
		chains: [],
	};
}

const result: UnusedScanResult = {
	totalVariables: 10,
	publishedNames: [],
	unused: [
		unused('brand-bg', ['button-bg', 'card-bg']),
		unused('button-bg', [], 'brand-bg'),
		unused('card-bg', [], 'brand-bg'),
		unused('old/divider'),
	],
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function freshStore() {
	vi.resetModules();
	const { useUnusedStore } = await import('../src/ui/store/unused-store');
	return useUnusedStore;
}

async function storeWithResult() {
	const useUnusedStore = await freshStore();
	useUnusedStore.setState({ isOpen: true, status: 'done', result, resultScanId: 'scan-1' });
	return useUnusedStore;
}

describe('useUnusedStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('startScan opens the unused view and starts a scan', async () => {
		const useUnusedStore = await freshStore();
		mockCallPlugin.mockResolvedValue({ started: true });

		await useUnusedStore.getState().startScan();

		const state = useUnusedStore.getState();
		expect(state.isOpen).toBe(true);
		expect(state.status).toBe('scanning');
		expect(mockCallPlugin).toHaveBeenCalledWith('unusedScan.start', {
			scanId: state.activeScanId,
		});
	});

	test('ignores results from a stale scan', async () => {
		const useUnusedStore = await freshStore();
		useUnusedStore.setState({ status: 'scanning', activeScanId: 'scan-2' });

		useUnusedStore.getState()._complete('scan-1', result);

		expect(useUnusedStore.getState().status).toBe('scanning');
		expect(useUnusedStore.getState().result).toBeNull();
	});

	test('selecting a variable also selects the variables that point to it', async () => {
		const useUnusedStore = await storeWithResult();

		useUnusedStore.getState().toggleSelected('brand-bg');
		expect(useUnusedStore.getState().selectedIds.sort()).toEqual([
			'brand-bg',
			'button-bg',
			'card-bg',
		]);

		useUnusedStore.getState().toggleSelected('brand-bg');
		expect(useUnusedStore.getState().selectedIds).toEqual([]);
	});

	test('a variable that points to another can be selected on its own', async () => {
		const useUnusedStore = await storeWithResult();
		useUnusedStore.getState().toggleSelected('button-bg');
		expect(useUnusedStore.getState().selectedIds).toEqual(['button-bg']);
	});

	test('delete is not offered while the file changed since the scan', async () => {
		const useUnusedStore = await storeWithResult();
		useUnusedStore.setState({ selectedIds: ['old/divider'], isStale: true });

		useUnusedStore.getState().requestDelete();

		expect(useUnusedStore.getState().deleteStatus).toBe('idle');
	});

	test('confirmDelete sends the selection plus extra ids and shows the result', async () => {
		const useUnusedStore = await storeWithResult();
		mockCallPlugin.mockImplementation(async (procedure: string) =>
			procedure === 'unusedScan.delete'
				? {
						deletedIds: ['button-bg', 'card-bg', 'brand-bg'],
						skippedIds: [],
						versionSaved: true,
					}
				: { variables: [] },
		);
		useUnusedStore.setState({ selectedIds: ['button-bg', 'card-bg', 'old/divider'] });
		useUnusedStore.setState({
			deleteStatus: 'confirming',
			deleteTargetIds: ['button-bg', 'card-bg'],
		});

		const deleted = await useUnusedStore.getState().confirmDelete(['brand-bg']);

		expect(deleted).toBe(true);
		expect(mockCallPlugin).toHaveBeenCalledWith(
			'unusedScan.delete',
			{ scanId: 'scan-1', ids: ['button-bg', 'card-bg', 'brand-bg'] },
			// Longer than the 30 second default: saving a version can take a while.
			{ timeout: 5 * 60 * 1000 },
		);
		expect(useUnusedStore.getState().deleteStatus).toBe('done');
		// Only what was deleted leaves the selection.
		expect(useUnusedStore.getState().selectedIds).toEqual(['old/divider']);
	});

	test('a STALE refusal keeps the dialog open and marks the results out of date', async () => {
		const useUnusedStore = await storeWithResult();
		mockCallPlugin.mockResolvedValue({
			deletedIds: [],
			skippedIds: [],
			versionSaved: false,
			error: {
				code: 'STALE',
				message: 'The file changed since the scan. Rescan before deleting.',
			},
		});
		useUnusedStore.getState().requestDeleteOne('old/divider');

		await useUnusedStore.getState().confirmDelete();

		const state = useUnusedStore.getState();
		expect(state.deleteStatus).toBe('confirming');
		expect(state.deleteError).toContain('Rescan');
		expect(state.isStale).toBe(true);
	});

	test('a partial delete drops what was deleted and marks the results out of date', async () => {
		const useUnusedStore = await storeWithResult();
		mockCallPlugin.mockImplementation(async (procedure: string) =>
			procedure === 'unusedScan.delete'
				? {
						deletedIds: ['button-bg'],
						skippedIds: [],
						versionSaved: true,
						error: {
							code: 'PARTIAL',
							message: 'Deleted 1 of 3 variables, then stopped',
						},
					}
				: { variables: [] },
		);
		useUnusedStore.setState({ selectedIds: ['brand-bg', 'button-bg', 'card-bg'] });
		useUnusedStore.getState().requestDelete();

		await useUnusedStore.getState().confirmDelete();

		const state = useUnusedStore.getState();
		expect(state.deleteStatus).toBe('confirming');
		expect(state.deleteError).toContain('Deleted 1 of 3');
		expect(state.deleteError).toContain('Scan again');
		expect(state.isStale).toBe(true);
		expect(state.selectedIds).toEqual(['brand-bg', 'card-bg']);
		expect(state.deleteTargetIds).toEqual(['brand-bg', 'card-bg']);
		// Refreshes the variable list, which no longer has button-bg.
		expect(mockCallPlugin).toHaveBeenCalledWith('get-variables');
	});

	test('no answer from the plugin blocks a retry, since it may still be deleting', async () => {
		const useUnusedStore = await storeWithResult();
		mockCallPlugin.mockRejectedValue(new Error('RPC call timed out'));
		useUnusedStore.getState().requestDeleteOne('old/divider');

		const deleted = await useUnusedStore.getState().confirmDelete();

		const state = useUnusedStore.getState();
		expect(deleted).toBe(false);
		expect(state.deleteStatus).toBe('confirming');
		expect(state.deleteError).toContain('may already be gone');
		expect(state.isStale).toBe(true);
	});

	test('a second confirm while deleting is ignored', async () => {
		const useUnusedStore = await storeWithResult();
		let finish: (value: unknown) => void = () => {};
		mockCallPlugin.mockImplementation((procedure: string) =>
			procedure === 'unusedScan.delete'
				? new Promise((resolve) => (finish = resolve))
				: Promise.resolve({ variables: [] }),
		);
		useUnusedStore.getState().requestDeleteOne('old/divider');

		const first = useUnusedStore.getState().confirmDelete();
		const second = await useUnusedStore.getState().confirmDelete();
		finish({ deletedIds: ['old/divider'], skippedIds: [], versionSaved: true });

		expect(second).toBe(false);
		expect(await first).toBe(true);
		expect(mockCallPlugin.mock.calls.filter((c) => c[0] === 'unusedScan.delete')).toHaveLength(
			1,
		);
	});

	test('a finished scan remembers its id for deleting', async () => {
		const useUnusedStore = await freshStore();
		useUnusedStore.setState({ activeScanId: 'scan-7', status: 'scanning' });

		useUnusedStore.getState()._complete('scan-7', result);

		expect(useUnusedStore.getState().resultScanId).toBe('scan-7');
	});

	test('deleting one variable targets it and what points to it, not the selection', async () => {
		const useUnusedStore = await storeWithResult();
		useUnusedStore.setState({ selectedIds: ['old/divider'] });

		useUnusedStore.getState().requestDeleteOne('brand-bg');

		const state = useUnusedStore.getState();
		expect(state.deleteStatus).toBe('confirming');
		expect([...state.deleteTargetIds].sort()).toEqual(['brand-bg', 'button-bg', 'card-bg']);
		expect(state.selectedIds).toEqual(['old/divider']);
	});

	test('switching tabs keeps the results; closing the tab clears them', async () => {
		const useUnusedStore = await storeWithResult();
		useUnusedStore.setState({ isActive: true });

		useUnusedStore.getState().showSearch();
		expect(useUnusedStore.getState().isActive).toBe(false);
		expect(useUnusedStore.getState().result).toBe(result);

		useUnusedStore.getState().showUnused();
		expect(useUnusedStore.getState().isActive).toBe(true);

		await useUnusedStore.getState().close();
		expect(useUnusedStore.getState()).toMatchObject({
			isOpen: false,
			isActive: false,
			result: null,
		});
	});

	describe('cancelling', () => {
		test('a scan that finishes while cancelling keeps its results', async () => {
			const useUnusedStore = await freshStore();
			useUnusedStore.setState({ isOpen: true, status: 'scanning', activeScanId: 'scan-1' });
			const cancel = deferred<{ cancelled: boolean }>();
			mockCallPlugin.mockReturnValue(cancel.promise);

			const cancelling = useUnusedStore.getState().cancelScan();
			useUnusedStore.getState()._complete('scan-1', result);
			cancel.resolve({ cancelled: false });
			await cancelling;

			expect(useUnusedStore.getState()).toMatchObject({
				status: 'done',
				result,
				resultScanId: 'scan-1',
			});
		});

		test('a failed cancel request is caught and still stops the scan', async () => {
			const useUnusedStore = await freshStore();
			useUnusedStore.setState({ isOpen: true, status: 'scanning', activeScanId: 'scan-1' });
			mockCallPlugin.mockRejectedValue(new Error('RPC call timed out'));

			await expect(useUnusedStore.getState().cancelScan()).resolves.toBeUndefined();

			expect(useUnusedStore.getState()).toMatchObject({ status: 'idle', activeScanId: null });
		});

		test('closing the tab never waits on or fails with the cancel request', async () => {
			const useUnusedStore = await freshStore();
			useUnusedStore.setState({
				isOpen: true,
				isActive: true,
				status: 'scanning',
				activeScanId: 'scan-1',
			});
			const cancel = deferred<{ cancelled: boolean }>();
			mockCallPlugin.mockReturnValue(cancel.promise);

			const closing = useUnusedStore.getState().close();
			expect(useUnusedStore.getState()).toMatchObject({ isOpen: false, status: 'idle' });

			cancel.reject(new Error('RPC call timed out'));
			await expect(closing).resolves.toBeUndefined();
			useUnusedStore.getState()._complete('scan-1', result);
			expect(useUnusedStore.getState()).toMatchObject({ isOpen: false, result: null });
		});

		test('a scan still starts when stopping the running search fails', async () => {
			const useUnusedStore = await freshStore();
			const { usePluginStore } = await import('../src/ui/store/plugin-store');
			usePluginStore.setState({ isSearching: true, activeSearchId: 'search-1' });
			mockCallPlugin.mockImplementation((method: string) =>
				method === 'variableSearch.cancel'
					? Promise.reject(new Error('RPC call timed out'))
					: Promise.resolve({ started: true }),
			);

			await expect(useUnusedStore.getState().startScan()).resolves.toBeUndefined();

			expect(useUnusedStore.getState().status).toBe('scanning');
			expect(mockCallPlugin).toHaveBeenCalledWith('unusedScan.start', {
				scanId: useUnusedStore.getState().activeScanId,
			});
		});

		test('cancelling a rescan brings back the previous results', async () => {
			const useUnusedStore = await storeWithResult();
			useUnusedStore.setState({ selectedIds: ['old/divider'] });
			mockCallPlugin.mockResolvedValue({ started: true });

			await useUnusedStore.getState().startScan();
			expect(useUnusedStore.getState()).toMatchObject({ status: 'scanning', result: null });
			await useUnusedStore.getState().cancelScan();

			expect(useUnusedStore.getState()).toMatchObject({
				status: 'done',
				result,
				resultScanId: 'scan-1',
				isStale: false,
				selectedIds: ['old/divider'],
				activeScanId: null,
				previousScan: null,
			});
		});

		test('previous results brought back by Cancel stay out of date', async () => {
			const useUnusedStore = await storeWithResult();
			useUnusedStore.setState({ isStale: true });
			mockCallPlugin.mockResolvedValue({ started: true });

			await useUnusedStore.getState().startScan();
			await useUnusedStore.getState().cancelScan();

			expect(useUnusedStore.getState()).toMatchObject({ status: 'done', isStale: true });
		});

		test('a stale notice during a rescan marks the previous results out of date', async () => {
			const useUnusedStore = await storeWithResult();
			mockCallPlugin.mockResolvedValue({ started: true });

			await useUnusedStore.getState().startScan();
			useUnusedStore.getState()._setStale();
			await useUnusedStore.getState().cancelScan();

			expect(useUnusedStore.getState()).toMatchObject({ status: 'done', isStale: true });
		});

		test('a finished rescan replaces the previous results', async () => {
			const useUnusedStore = await storeWithResult();
			useUnusedStore.setState({ isStale: true });
			mockCallPlugin.mockResolvedValue({ started: true });
			const newer: UnusedScanResult = { ...result, unused: [unused('old/divider')] };

			await useUnusedStore.getState().startScan();
			const scanId = useUnusedStore.getState().activeScanId!;
			useUnusedStore.getState()._complete(scanId, newer);

			expect(useUnusedStore.getState()).toMatchObject({
				status: 'done',
				result: newer,
				resultScanId: scanId,
				isStale: false,
				previousScan: null,
			});
		});

		test('results from before a delete are not brought back', async () => {
			const useUnusedStore = await storeWithResult();
			useUnusedStore.setState({ deleteStatus: 'done' });
			mockCallPlugin.mockResolvedValue({ started: true });

			await useUnusedStore.getState().startScan();
			await useUnusedStore.getState().cancelScan();

			expect(useUnusedStore.getState()).toMatchObject({ status: 'idle', result: null });
		});
	});
});
