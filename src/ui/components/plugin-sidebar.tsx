import React, { useMemo, useState } from 'react';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
} from './ui/sidebar';
import { Button } from './ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';
import { Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useVariables } from '@/store/selectors';
import { searchVariables } from '@/lib/search';

const PluginSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
	const [inputValue, setInputValue] = useState('');
	const debouncedQuery = useDebounce(inputValue, 150);

	const variables = useVariables();

	const suggestions = useMemo(() => {
		return searchVariables(variables, debouncedQuery, 10);
	}, [variables, debouncedQuery]);

	console.log('Suggestions:', suggestions);

	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<h1 className="text-xl font-bold">Search & Filter</h1>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<div className="flex w-full max-w-sm items-center gap-2">
							<InputGroup className="bg-white">
								<InputGroupInput
									type="text"
									id="search-field"
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									placeholder="Search for variables..."
								/>
								<InputGroupAddon>
									<Search />
								</InputGroupAddon>
							</InputGroup>
							<Button>Search</Button>
						</div>
					</SidebarGroupContent>
					<SidebarGroupContent>
						{suggestions.map((scoredVar) => (
							<div
								key={scoredVar.variable.id}
								className="p-2 hover:bg-gray-100 rounded"
							>
								{scoredVar.variable.name}
							</div>
						))}
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup />
			</SidebarContent>
			<SidebarFooter />
		</Sidebar>
	);
};

export default PluginSidebar;
