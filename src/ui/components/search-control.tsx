import { usePluginStore } from '@/store/plugin-store';
import { searchVariables } from '@/lib/search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from './ui/command';
import InstanceIcon from './instance-icon';
import { cn } from '@/lib/utils';
import { CommandSeparator } from 'cmdk';

const SearchControl = () => {
	const { variables, setSearchQuery, searchQuery, startSearch, scope } = usePluginStore(
		useShallow((state) => ({
			variables: state.variables,
			setSearchQuery: state.setSearchQuery,
			searchQuery: state.searchQuery,
			startSearch: state.startSearch,
			scope: state.scope,
		})),
	);

	const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

	const suggestions = useMemo(() => {
		return searchVariables(variables, searchQuery);
	}, [variables, searchQuery]);

	const close = useCallback(() => setIsSuggestionsOpen(false), []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				close();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	return (
		<div className="relative">
			<Command
				className={cn(
					'bg-white border-none search-input-shadow',
					isSuggestionsOpen ? 'rounded-b-none border-none' : 'rounded-[12px]',
				)}
				shouldFilter={false}
				loop
			>
				<CommandInput
					className={cn('h-11')}
					placeholder="Type in variable name e.g., colors/primary, spacing-md..."
					value={searchQuery}
					onValueChange={(value) => {
						console.log('Search query changed:', value);
						setSearchQuery(value);
						if (value.length > 0) {
							setIsSuggestionsOpen(true);
						} else {
							close();
						}
					}}
				/>
				{isSuggestionsOpen && (
					<CommandList className="absolute top-full w-full bg-white rounded-bl-2xl rounded-br-2xl search-suggestions-shadow z-50">
						<CommandSeparator />
						<CommandGroup>
							{suggestions.map(({ variable }) => (
								<CommandItem
									className="flex gap-x-1 last-of-type:rounded-b-2xl last-of-type:rounded-t-none font-mono"
									key={variable.id}
									onSelect={async () => {
										close();
										setSearchQuery(variable.name);
										await startSearch(variable, scope);
									}}
									value={`${variable.id}-${variable.name}`}
								>
									<InstanceIcon
										type={variable.resolvedType}
										className="w-4 h-4"
									/>
									<span>{variable.name}</span>
								</CommandItem>
							))}
							{suggestions.length === 0 && (
								<CommandEmpty>No results found.</CommandEmpty>
							)}
						</CommandGroup>
					</CommandList>
				)}
			</Command>
		</div>
	);
};

export default SearchControl;
