import { useMemo, useState } from 'react';
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CopySmallIcon,
	TrashIcon,
} from '../icons/ui3';
import { useUnusedStore } from '@/store/unused-store';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { Button } from '../ui/button';
import UnusedRow from './unused-row';
import UnusedDeleteDialog from './unused-delete-dialog';
import { buildGroups, buildLockMap, type UnusedGroup } from './unused-tree-model';
import { filterGroup, type FilteredGroup } from './unused-filter';

const COPIED_RESET_MS = 2000;

type GroupProps = {
	group: UnusedGroup;
	shown: FilteredGroup;
	isFiltering: boolean;
	locks: Map<string, string>;
};

const GroupSection = ({ group, shown, isFiltering, locks }: GroupProps) => {
	const selectMany = useUnusedStore((s) => s.selectMany);
	const [isOpen, setIsOpen] = useState(!group.isPalette);

	const { nodes, ids } = shown;
	if (isFiltering && ids.length === 0) return null;
	const showRows = isOpen || isFiltering;
	// While filtering, "Select" takes only the variables in view.
	const isPartial = ids.length < group.ids.length;

	return (
		<section aria-label={group.name} className="border-t">
			<div className="flex h-8 items-center gap-x-2 pl-2 pr-4">
				<button
					type="button"
					className="flex min-w-0 items-center text-left outline-none focus-visible:outline-1 focus-visible:outline-border-selected"
					onClick={() => setIsOpen(!isOpen)}
					aria-expanded={showRows}
				>
					{showRows ? (
						<ChevronDownIcon
							className="size-6 shrink-0 text-icon-secondary"
							aria-hidden="true"
						/>
					) : (
						<ChevronRightIcon
							className="size-6 shrink-0 text-icon-secondary"
							aria-hidden="true"
						/>
					)}
					<span className="font-strong truncate">{group.name}</span>
					<span className="ml-1.5 text-muted-foreground truncate">
						{group.isPalette
							? `· ${group.ids.length} palette value${group.ids.length === 1 ? '' : 's'}, usually kept on purpose`
							: group.ids.length}
					</span>
				</button>
				{!group.isPalette && (
					<Button
						variant="ghost"
						className="ml-auto shrink-0 text-foreground"
						onClick={() => selectMany(ids)}
					>
						{isPartial ? `Select ${ids.length}` : `Select all ${ids.length}`}
					</Button>
				)}
			</div>
			{showRows && (
				<ul className="pb-1">
					{nodes.map((node) => (
						<UnusedRow key={node.variable.id} node={node} locks={locks} />
					))}
				</ul>
			)}
		</section>
	);
};

const SelectionBar = () => {
	const result = useUnusedStore((s) => s.result);
	const selectedIds = useUnusedStore((s) => s.selectedIds);
	const isStale = useUnusedStore((s) => s.isStale);
	const clearSelection = useUnusedStore((s) => s.clearSelection);
	const requestDelete = useUnusedStore((s) => s.requestDelete);
	const [copied, setCopied] = useState(false);

	if (selectedIds.length === 0 || !result) return null;

	const handleCopy = async () => {
		const selected = new Set(selectedIds);
		const names = result.unused.filter((v) => selected.has(v.id)).map((v) => v.name);
		if (await copyToClipboard(names.join('\n'))) {
			setCopied(true);
			setTimeout(() => setCopied(false), COPIED_RESET_MS);
		}
	};

	return (
		<div className="sticky bottom-0 z-20 flex h-10 items-center gap-x-2 border-t bg-background pl-4 pr-2">
			<span>{selectedIds.length} selected</span>
			<Button variant="secondary" className="ml-auto" onClick={handleCopy}>
				{copied ? <CheckIcon aria-hidden="true" /> : <CopySmallIcon aria-hidden="true" />}
				{copied ? 'Copied' : 'Copy list'}
			</Button>
			<Button variant="secondary" onClick={clearSelection}>
				Clear
			</Button>
			<Button
				variant="destructive"
				disabled={isStale}
				title={isStale ? 'Rescan to delete' : undefined}
				onClick={requestDelete}
			>
				<TrashIcon aria-hidden="true" />
				{isStale ? 'Rescan to delete' : `Delete ${selectedIds.length}`}
			</Button>
		</div>
	);
};

const UnusedResults = () => {
	const result = useUnusedStore((s) => s.result);
	const isStale = useUnusedStore((s) => s.isStale);
	const rawFilter = useUnusedStore((s) => s.filter);
	const startScan = useUnusedStore((s) => s.startScan);
	const selectedIds = useUnusedStore((s) => s.selectedIds);
	const [showPublished, setShowPublished] = useState(false);

	const groups = useMemo(() => buildGroups(result?.unused ?? []), [result]);
	const locks = useMemo(
		() => buildLockMap(result?.unused ?? [], selectedIds),
		[result, selectedIds],
	);
	if (!result) return null;

	const filter = rawFilter.trim().toLowerCase();
	const deletableCount = result.unused.filter((v) => !v.isPalette).length;
	const keptCount = result.unused.length - deletableCount + result.publishedNames.length;
	const shownGroups = groups.map((group) => ({ group, shown: filterGroup(group, filter) }));
	const shownCount = new Set(shownGroups.flatMap(({ shown }) => shown.ids)).size;

	return (
		<div className="flex flex-col relative">
			{isStale && (
				<div
					className="flex min-h-10 items-center gap-x-2 bg-warning-subtle pl-4 pr-2 text-warning-text"
					role="status"
				>
					File changed. Rescan before deleting.
					<Button
						variant="secondary"
						className="ml-auto bg-background"
						onClick={() => void startScan()}
					>
						Rescan
					</Button>
				</div>
			)}

			<div className="flex h-10 items-center gap-x-2 pl-4 pr-2">
				<p className="text-muted-foreground">
					<span className="font-strong text-foreground">{deletableCount}</span> can be
					deleted
					{keptCount > 0 && <span> · {keptCount} kept</span>}
					{filter && <span> · {shownCount} shown</span>}
				</p>
				<Button variant="secondary" className="ml-auto" onClick={() => void startScan()}>
					Rescan
				</Button>
			</div>

			{deletableCount === 0 && (
				<div className="flex flex-col items-center gap-y-1 px-4 pb-6 pt-2 text-center">
					<CheckIcon className="size-6 text-success" aria-hidden="true" />
					<p className="text-heading-small font-strong">Nothing to clean up</p>
					<p className="text-muted-foreground">
						Every variable is applied to a layer or style, or used by one that is.
					</p>
				</div>
			)}

			{filter && shownCount === 0 && groups.length > 0 && (
				<div className="flex flex-col items-center gap-y-1 border-t px-4 py-6 text-center">
					<p className="font-strong">No unused variables match “{rawFilter.trim()}”</p>
					<p className="text-muted-foreground">
						Try part of a variable or collection name.
					</p>
				</div>
			)}

			{shownGroups.map(({ group, shown }) => (
				<GroupSection
					key={`${group.isPalette}-${group.name}`}
					group={group}
					shown={shown}
					isFiltering={!!filter}
					locks={locks}
				/>
			))}

			{result.publishedNames.length > 0 && (
				<div className="border-t py-1 pl-2 pr-4">
					<button
						type="button"
						className="flex h-6 items-center text-muted-foreground outline-none focus-visible:outline-1 focus-visible:outline-border-selected"
						onClick={() => setShowPublished(!showPublished)}
						aria-expanded={showPublished}
					>
						{showPublished ? (
							<ChevronDownIcon
								className="size-6 text-icon-secondary"
								aria-hidden="true"
							/>
						) : (
							<ChevronRightIcon
								className="size-6 text-icon-secondary"
								aria-hidden="true"
							/>
						)}
						Not shown: {result.publishedNames.length} published to a library
					</button>
					{showPublished && (
						<p className="pb-1 pl-6 text-muted-foreground">
							<span className="text-foreground">
								{result.publishedNames.join(', ')}
							</span>
							. Other files may use these. Check library analytics before removing
							them in the library.
						</p>
					)}
				</div>
			)}

			<p className="border-t px-4 py-3 text-muted-foreground">
				Checks layers (hidden ones too), styles, prototypes and component properties in this
				file.
			</p>

			<SelectionBar />
			<UnusedDeleteDialog />
		</div>
	);
};

export default UnusedResults;
