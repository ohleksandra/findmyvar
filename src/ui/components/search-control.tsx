import { usePlugin } from '@/context/plugin-context';
import { searchVariables } from '@/lib/search';
import { useCallback, useMemo, useState } from 'react';
import { CloseSmallIcon, DetachSmallIcon } from './icons/ui3';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from './ui/command';
import { Badge } from './ui/badge';
import { Kbd } from './ui/kbd';
import VariableTypeIcon from './variable-type-icon';
import { cn } from '@/lib/utils';
import type { Variable } from '../../shared/rpc-types';
import { useUnusedStore } from '@/store/unused-store';

const ACTION_PREFIX = '/';

type ActionId = 'find-unused';

interface CommandAction {
	id: ActionId;
	label: string;
	keywords: string;
	hint?: string;
	/** Shows a "New" tag so people notice a recently added action. */
	isNew?: boolean;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const ACTIONS: CommandAction[] = [
	{
		id: 'find-unused',
		label: 'Find unused variables',
		keywords: 'unused clean audit find',
		hint: 'Whole file',
		isNew: true,
		icon: DetachSmallIcon,
	},
];

function matchActions(query: string): CommandAction[] {
	const q = query.toLowerCase().trim();
	if (!q) return ACTIONS;
	return ACTIONS.filter((action) =>
		`${action.label} ${action.keywords}`.toLowerCase().includes(q),
	);
}

const SearchControl = () => {
	const { state, actions } = usePlugin();
	const { variables, searchQuery, scope, recentSearches } = state;
	const { setSearchQuery, startSearch, resetSearch } = actions;
	const isUnusedMode = useUnusedStore((s) => s.isActive);
	const unusedFilter = useUnusedStore((s) => s.filter);
	const setUnusedFilter = useUnusedStore((s) => s.setFilter);
	const startUnusedScan = useUnusedStore((s) => s.startScan);
	const closeUnused = useUnusedStore((s) => s.close);
	const showSearchTab = useUnusedStore((s) => s.showSearch);

	const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

	const trimmedQuery = searchQuery.trim();
	const isActionQuery = trimmedQuery.startsWith(ACTION_PREFIX);

	const suggestions = useMemo(() => {
		if (isActionQuery) return [];
		return searchVariables(variables, searchQuery);
	}, [variables, searchQuery, isActionQuery]);

	const matchingActions = useMemo(() => {
		// Actions stay listed under the variables while typing a name; only "/" narrows them down.
		if (isActionQuery) return matchActions(trimmedQuery.slice(ACTION_PREFIX.length));
		return ACTIONS;
	}, [trimmedQuery, isActionQuery]);

	const close = useCallback(() => setIsSuggestionsOpen(false), []);
	const open = useCallback(() => {
		if (!isUnusedMode) setIsSuggestionsOpen(true);
	}, [isUnusedMode]);

	const selectVariable = async (variable: Variable) => {
		close();
		setSearchQuery(variable.name);
		await startSearch(variable, scope);
	};

	const runAction = async (id: ActionId) => {
		close();
		setSearchQuery('');
		if (id === 'find-unused') {
			await startUnusedScan();
		}
	};

	const showRecent = !trimmedQuery && recentSearches.length > 0;
	const showVariables = !!trimmedQuery && suggestions.length > 0;
	// Actions are always listed, so without this a name that matches nothing would look like a match.
	const showNoVariables = !!trimmedQuery && !isActionQuery && suggestions.length === 0;
	const showActions = matchingActions.length > 0;
	const hasItems = showRecent || showVariables || showActions;
	const inputValue = isUnusedMode ? unusedFilter : searchQuery;

	return (
		<div className="relative">
			<Command className="bg-transparent overflow-visible" shouldFilter={false} loop>
				<CommandInput
					placeholder={
						isUnusedMode
							? 'Filter unused variables'
							: `Search variables or type ${ACTION_PREFIX} for actions`
					}
					value={inputValue}
					// Open: the field becomes the top of one white panel with the list below,
					// like Figma's quick actions. Each half drops the shadow edge where they meet.
					wrapperClassName={cn(
						isSuggestionsOpen &&
							'rounded-b-none rounded-t-xl bg-popover shadow-menu ring-1 ring-border-translucent focus-within:border-transparent [clip-path:inset(-24px_-24px_0_-24px)]',
					)}
					startAdornment={
						isUnusedMode && (
							<span className="mr-1 flex h-5 shrink-0 items-center rounded-md border border-brand-text/20 bg-selected pr-0.5 text-brand-text">
								<DetachSmallIcon
									className="size-5 text-brand-text"
									aria-hidden="true"
								/>
								Unused
								<button
									type="button"
									className="ml-0.5 flex rounded-sm text-icon-secondary outline-none hover:bg-hover-translucent hover:text-icon focus-visible:outline-1 focus-visible:outline-border-selected"
									aria-label="Close unused variables"
									// Keep focus in the input.
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => void closeUnused()}
								>
									<CloseSmallIcon className="size-4" aria-hidden="true" />
								</button>
							</span>
						)
					}
					shortcut={
						inputValue ? (
							<button
								type="button"
								className="flex rounded-sm text-icon-secondary outline-none hover:bg-hover-translucent hover:text-icon focus-visible:outline-1 focus-visible:outline-border-selected"
								aria-label={isUnusedMode ? 'Clear filter' : 'Clear search'}
								// Keep focus in the input.
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									close();
									if (isUnusedMode) {
										setUnusedFilter('');
									} else {
										void resetSearch();
									}
								}}
							>
								<CloseSmallIcon className="size-5" aria-hidden="true" />
							</button>
						) : isUnusedMode ? null : (
							// An empty field has nothing to search, so point to the actions instead.
							<Kbd aria-hidden="true">{ACTION_PREFIX}</Kbd>
						)
					}
					onValueChange={(value) => {
						if (isUnusedMode) {
							setUnusedFilter(value);
							return;
						}
						setSearchQuery(value);
						open();
					}}
					onClick={open}
					onBlur={close}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							close();
						} else if (e.key === 'Backspace' && isUnusedMode && !unusedFilter) {
							// Like removing a tag: back to the Search tab, results stay in their tab.
							showSearchTab();
						} else if (e.key === 'ArrowDown' && !isSuggestionsOpen) {
							open();
						}
					}}
					autoFocus
				/>

				{isSuggestionsOpen && (
					<CommandList
						className="absolute top-full right-0 left-0 z-40 rounded-t-none border-t ring-1 ring-border-translucent [clip-path:inset(0_-24px_-24px_-24px)]"
						// Keep focus in the input so clicking an item doesn't close the list first.
						onMouseDown={(e) => e.preventDefault()}
					>
						{showRecent && (
							<CommandGroup heading="Recent">
								{recentSearches.map((variable) => (
									<CommandItem
										className="pl-0"
										key={variable.id}
										onSelect={() => selectVariable(variable)}
										value={`recent-${variable.id}`}
									>
										<VariableTypeIcon
											type={variable.resolvedType}
											className="inline-flex size-6"
										/>
										<span className="truncate">{variable.name}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{showVariables && (
							<CommandGroup heading="Variables">
								{suggestions.map(({ variable }) => (
									<CommandItem
										className="pl-0"
										key={variable.id}
										onSelect={() => selectVariable(variable)}
										value={`${variable.id}-${variable.name}`}
									>
										<VariableTypeIcon
											type={variable.resolvedType}
											className="inline-flex size-6"
										/>
										<span className="truncate">{variable.name}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{showNoVariables && (
							<p className="text-muted-foreground px-4 py-1 text-body-medium">
								No variables match “{trimmedQuery}”
							</p>
						)}
						{showActions && (
							<CommandGroup
								heading="Actions"
								className={cn(
									(showRecent || showVariables || showNoVariables) &&
										'border-t mt-2 pt-2',
								)}
							>
								{matchingActions.map((action) => (
									<CommandItem
										className="pl-0"
										key={action.id}
										onSelect={() => runAction(action.id)}
										value={`action-${action.id}`}
									>
										<action.icon className="size-6" />
										<span>{action.label}</span>
										{action.isNew && <Badge variant="new">New</Badge>}
										{action.hint && (
											<span className="ml-auto text-muted-foreground">
												{action.hint}
											</span>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{!hasItems && <CommandEmpty>No results found.</CommandEmpty>}
					</CommandList>
				)}
			</Command>
		</div>
	);
};

export default SearchControl;
