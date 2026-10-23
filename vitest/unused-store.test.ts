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

async function freshStore() {
	vi.resetModules();
	const { useUnusedStore } = await import('../src/ui/store/unused-store');
	return useUnusedStore;
}

async function storeWithResult() {
	const useUnusedStore = await freshStore();
	useUnusedStore.setState({ isOpen: true, status: 'done', result });
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
				? { deletedIds: ['button-bg', 'card-bg', 'brand-bg'], versionSaved: true }
				: { variables: [] },
		);
		useUnusedStore.setState({ selectedIds: ['button-bg', 'card-bg', 'old/divider'] });
		useUnusedStore.setState({
			deleteStatus: 'confirming',
			deleteTargetIds: ['button-bg', 'card-bg'],
		});

		await useUnusedStore.getState().confirmDelete(['brand-bg']);

		expect(mockCallPlugin).toHaveBeenCalledWith('unusedScan.delete', {
			ids: ['button-bg', 'card-bg', 'brand-bg'],
		});
		expect(useUnusedStore.getState().deleteStatus).toBe('done');
		// Only what was deleted leaves the selection.
		expect(useUnusedStore.getState().selectedIds).toEqual(['old/divider']);
	});

	test('a failed delete keeps the dialog open with the error', async () => {
		const useUnusedStore = await storeWithResult();
		mockCallPlugin.mockRejectedValue(
			new Error('The file changed since the scan. Rescan before deleting.'),
		);
		useUnusedStore.getState().requestDeleteOne('old/divider');

		await useUnusedStore.getState().confirmDelete();

		const state = useUnusedStore.getState();
		expect(state.deleteStatus).toBe('confirming');
		expect(state.deleteError).toContain('Rescan');
		expect(state.isStale).toBe(true);
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
});
