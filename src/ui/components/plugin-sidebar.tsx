import React from 'react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader } from './ui/sidebar';
import { Button } from './ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';
import { Search } from 'lucide-react';

const PluginSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
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
								<InputGroupInput type="text" id="search-field" placeholder="Search for variables..." />
								<InputGroupAddon>
									<Search />
								</InputGroupAddon>
							</InputGroup>
							<Button>Search</Button>
						</div>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup />
			</SidebarContent>
			<SidebarFooter />
		</Sidebar>
	);
};

export default PluginSidebar;
