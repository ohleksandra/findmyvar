import { useUnusedStore } from '@/store/unused-store';
import { cn } from '@/lib/utils';
import { CloseSmallIcon, DetachSmallIcon, SearchSmallIcon } from './icons/ui3';

// Styled like Figma's file tabs at the top of the window: a slightly darker bar, the active tab
// takes the panel colour and joins the content below, with 1px dividers between tabs.
const tabClass = (active: boolean) =>
	cn(
		'group relative flex h-10 min-w-36 max-w-60 shrink-0 items-center gap-x-1 border-r pl-2 pr-1',
		active
			? '-mb-px bg-background text-foreground'
			: 'text-muted-foreground hover:bg-hover-translucent hover:text-foreground',
	);

const iconClass = (active: boolean) =>
	cn('size-6 shrink-0', active ? 'text-brand-text' : 'text-icon-secondary');

/** "Search" and a closable "Unused variables" tab, shown once the unused scan has been opened. */
const WorkspaceTabs = () => {
	const isOpen = useUnusedStore((s) => s.isOpen);
	const isActive = useUnusedStore((s) => s.isActive);
	const showSearch = useUnusedStore((s) => s.showSearch);
	const showUnused = useUnusedStore((s) => s.showUnused);
	const close = useUnusedStore((s) => s.close);

	if (!isOpen) return null;

	return (
		<div role="tablist" className="flex w-full border-b bg-secondary">
			<div className={tabClass(!isActive)}>
				<button
					type="button"
					role="tab"
					aria-selected={!isActive}
					className="flex min-w-0 flex-1 items-center gap-x-1 self-stretch outline-none after:absolute after:inset-0 focus-visible:after:outline-1 focus-visible:after:-outline-offset-1 focus-visible:after:outline-border-selected"
					onClick={showSearch}
				>
					<SearchSmallIcon className={iconClass(!isActive)} aria-hidden="true" />
					<span className="truncate">Search</span>
				</button>
			</div>
			<div className={tabClass(isActive)}>
				<button
					type="button"
					role="tab"
					aria-selected={isActive}
					className="flex min-w-0 flex-1 items-center gap-x-1 self-stretch outline-none after:absolute after:inset-0 focus-visible:after:outline-1 focus-visible:after:-outline-offset-1 focus-visible:after:outline-border-selected"
					onClick={showUnused}
				>
					<DetachSmallIcon className={iconClass(isActive)} aria-hidden="true" />
					<span className="truncate">Unused variables</span>
				</button>
				{/* Only shown on hover or keyboard focus. */}
				<button
					type="button"
					className={cn(
						'relative z-10 flex shrink-0 rounded-md text-icon-secondary outline-none hover:bg-hover-translucent hover:text-icon focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-border-selected',
						'opacity-0 group-hover:opacity-100',
					)}
					aria-label="Close Unused variables tab"
					onClick={() => void close()}
				>
					<CloseSmallIcon className="size-6" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
};

export default WorkspaceTabs;
