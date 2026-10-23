import { useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CopySmallIcon, TrashIcon } from '../icons/ui3';
import { useUnusedStore } from '@/store/unused-store';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import VariableTypeIcon from '../variable-type-icon';
import UnusedValues from './unused-values';
import { usedOnlyByLabel, type UnusedNode } from './unused-tree-model';
import { buildChildrenMap, descendantsOf } from '../../../shared/unused-tree';

const COPIED_RESET_MS = 2000;

type Props = {
	node: UnusedNode;
	/** For each locked variable, the name of the selected variable it gets deleted with. */
	locks: Map<string, string>;
	isChild?: boolean;
};

const Swatch = ({ node }: { node: UnusedNode }) => {
	const color = node.variable.chains[0]?.color;
	if (color) {
		return (
			<span
				className="size-3.5 shrink-0 rounded-[3px] border border-border-translucent"
				style={{ background: color }}
				aria-hidden="true"
			/>
		);
	}
	return (
		<VariableTypeIcon
			type={node.variable.resolvedType}
			className="size-6 -mx-1 shrink-0 text-icon"
		/>
	);
};

const UnusedRow = ({ node, locks, isChild = false }: Props) => {
	const { variable, children } = node;
	const isSelected = useUnusedStore((s) => s.selectedIds.includes(variable.id));
	const isExpanded = useUnusedStore((s) => s.expandedId === variable.id);
	const toggleSelected = useUnusedStore((s) => s.toggleSelected);
	const toggleExpanded = useUnusedStore((s) => s.toggleExpanded);
	const requestDeleteOne = useUnusedStore((s) => s.requestDeleteOne);
	const isStale = useUnusedStore((s) => s.isStale);
	const result = useUnusedStore((s) => s.result);
	const [copied, setCopied] = useState(false);

	const deleteCount = useMemo(
		() =>
			isExpanded && result
				? 1 + descendantsOf(variable.id, buildChildrenMap(result.unused)).length
				: 1,
		[isExpanded, result, variable.id],
	);

	const lockedBy = locks.get(variable.id);
	// Only say something the tree doesn't already show: "Used only by" is redundant when those
	// variables sit right underneath (it still matters for palette rows and while filtering).
	const shownBelow = new Set(children.map((c) => c.variable.id));
	const hiddenUsers = variable.usedBy.filter((u) => !shownBelow.has(u.id));
	const reason = lockedBy
		? `Deleted with ${lockedBy}`
		: hiddenUsers.length > 0
			? usedOnlyByLabel(variable.usedBy)
			: null;
	const detailsId = `unused-details-${variable.id}`;

	const handleCopy = async () => {
		if (await copyToClipboard(variable.name)) {
			setCopied(true);
			setTimeout(() => setCopied(false), COPIED_RESET_MS);
		}
	};

	return (
		<li className={cn(isChild && 'unused-tree-child')}>
			<div
				className={cn(
					'relative flex items-center gap-x-2 pr-2 min-h-8 hover:bg-hover',
					isExpanded && 'bg-secondary',
					isChild ? 'pl-1' : 'pl-4',
				)}
			>
				{isChild && <span className="unused-tree-elbow" aria-hidden="true" />}
				<Checkbox
					checked={isSelected || !!lockedBy}
					disabled={!!lockedBy}
					onChange={() => toggleSelected(variable.id)}
					aria-label={`Select ${variable.name}`}
				/>
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-x-2 self-stretch py-1 text-left outline-none focus-visible:outline-1 focus-visible:outline-border-selected"
					onClick={() => toggleExpanded(variable.id)}
					aria-expanded={isExpanded}
					aria-controls={detailsId}
				>
					<Swatch node={node} />
					<span className="flex min-w-0 flex-col">
						<span className="truncate" title={variable.name}>
							{variable.name}
						</span>
						{reason && (
							<span className="truncate text-muted-foreground" title={reason}>
								{reason}
							</span>
						)}
					</span>
					{isExpanded ? (
						<ChevronUpIcon
							className="ml-auto size-6 shrink-0 text-icon-secondary"
							aria-hidden="true"
						/>
					) : (
						<ChevronDownIcon
							className="ml-auto size-6 shrink-0 text-icon-secondary"
							aria-hidden="true"
						/>
					)}
				</button>
			</div>

			{isExpanded && (
				<div
					id={detailsId}
					className={cn(
						'flex flex-col gap-y-3 border-b bg-secondary py-3 pr-4',
						isChild ? 'pl-6' : 'pl-[44px]',
					)}
				>
					<UnusedValues chains={variable.chains} />
					<p className="text-muted-foreground">
						{variable.usedBy.length > 0
							? `Not applied to any layer or style. Used only by ${variable.usedBy
									.map((u) => u.name)
									.join(', ')}, which aren't used either.`
							: 'Not applied to any layer or style, and no other variable uses it.'}
					</p>
					<div className="flex gap-x-2">
						<Button variant="secondary" className="bg-background" onClick={handleCopy}>
							{copied ? (
								<CheckIcon aria-hidden="true" />
							) : (
								<CopySmallIcon aria-hidden="true" />
							)}
							{copied ? 'Copied' : 'Copy name'}
						</Button>
						<Button
							variant="secondary"
							className="bg-background text-danger-text"
							disabled={isStale}
							title={isStale ? 'Rescan to delete' : undefined}
							onClick={() => requestDeleteOne(variable.id)}
						>
							<TrashIcon aria-hidden="true" />
							{deleteCount > 1 ? `Delete all ${deleteCount}` : 'Delete'}
						</Button>
					</div>
				</div>
			)}

			{children.length > 0 && (
				<ul className="ml-[23px]">
					{children.map((child) => (
						<UnusedRow key={child.variable.id} node={child} locks={locks} isChild />
					))}
				</ul>
			)}
		</li>
	);
};

export default UnusedRow;
