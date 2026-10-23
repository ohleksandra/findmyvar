import { useMemo, useState } from 'react';
import { useUnusedStore } from '@/store/unused-store';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Spinner } from '../ui/spinner';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '../ui/dialog';
import type { UnusedVariable } from '../../../shared/rpc-types';

/** Unused variables left with nothing pointing to them once the selection is deleted. */
function findOrphanedParents(unused: UnusedVariable[], selected: Set<string>): UnusedVariable[] {
	return unused.filter(
		(parent) =>
			!selected.has(parent.id) &&
			!parent.isPalette &&
			parent.usedBy.length > 0 &&
			parent.usedBy.every((dependent) => selected.has(dependent.id)),
	);
}

const UnusedDeleteDialog = () => {
	const result = useUnusedStore((s) => s.result);
	const selectedIds = useUnusedStore((s) => s.deleteTargetIds);
	const deleteStatus = useUnusedStore((s) => s.deleteStatus);
	const deleteError = useUnusedStore((s) => s.deleteError);
	const isStale = useUnusedStore((s) => s.isStale);
	const cancelDelete = useUnusedStore((s) => s.cancelDelete);
	const confirmDelete = useUnusedStore((s) => s.confirmDelete);
	const [alsoDelete, setAlsoDelete] = useState<string[]>([]);

	const isOpen = deleteStatus === 'confirming' || deleteStatus === 'deleting';
	const isDeleting = deleteStatus === 'deleting';

	const { items, orphans, byId } = useMemo(() => {
		const unused = result?.unused ?? [];
		const selected = new Set(selectedIds);
		return {
			items: unused.filter((v) => selected.has(v.id)),
			orphans: findOrphanedParents(unused, selected),
			byId: new Map(unused.map((v) => [v.id, v])),
		};
	}, [result, selectedIds]);

	const count = items.length + alsoDelete.length;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open && !isDeleting) {
					setAlsoDelete([]);
					cancelDelete();
				}
			}}
		>
			<DialogContent className="max-w-[360px]" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>
						Delete {count} variable{count === 1 ? '' : 's'}?
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-y-3 px-4 py-3">
					<DialogDescription>
						We'll save a version first. You can restore it from Version history.
					</DialogDescription>

					<ul className="flex max-h-40 flex-col gap-y-1 overflow-y-auto">
						{items.map((variable) => {
							const parent = variable.parentId
								? byId.get(variable.parentId)
								: undefined;
							const pointsToSelected = parent && selectedIds.includes(parent.id);
							return (
								<li key={variable.id} className="flex items-baseline gap-x-2">
									<span>{variable.name}</span>
									{pointsToSelected && (
										<span className="text-muted-foreground">
											points to {parent.name}
										</span>
									)}
								</li>
							);
						})}
					</ul>

					{orphans.map((parent) => (
						<label
							key={parent.id}
							className="flex items-center gap-x-2 rounded-md bg-secondary p-2"
						>
							<Checkbox
								checked={alsoDelete.includes(parent.id)}
								onChange={(e) =>
									setAlsoDelete((prev) =>
										e.target.checked
											? [...prev, parent.id]
											: prev.filter((id) => id !== parent.id),
									)
								}
							/>
							<span>
								Also delete <span className="font-strong">{parent.name}</span>{' '}
								(nothing else will use it)
							</span>
						</label>
					))}

					{deleteError && (
						<p className="text-danger-text" role="alert">
							{deleteError}
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="secondary"
						disabled={isDeleting}
						onClick={() => {
							setAlsoDelete([]);
							cancelDelete();
						}}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						// While deleting, stay red so it reads as busy. Out-of-date results need a rescan.
						className={cn(isDeleting && 'disabled:bg-destructive')}
						disabled={isDeleting || isStale}
						onClick={async () => {
							// After a failure the dialog stays open, with the same choices.
							if (await confirmDelete(alsoDelete)) setAlsoDelete([]);
						}}
					>
						{isDeleting && <Spinner className="text-primary-foreground" />}
						{isDeleting ? 'Deleting…' : 'Delete'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default UnusedDeleteDialog;
