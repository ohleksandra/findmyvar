import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { usePluginStore } from '@/store/plugin-store';
import type { SearchScope } from '../../shared/rpc-types';
import { useShallow } from 'zustand/react/shallow';

const ScopeSelector = () => {
	const { setScope, isSearching } = usePluginStore(
		useShallow((state) => ({
			setScope: state.setSearchScope,
			isSearching: state.isSearching,
		})),
	);

	return (
		<div className="flex items-center gap-x-2">
			<p className="font-sans text-sm font-medium">Scope:</p>
			<Tabs
				defaultValue="all-pages"
				onValueChange={(value) => setScope(value as SearchScope)}
			>
				<TabsList className="bg-[#E5E6E8] text-sm font-medium font-sans">
					<TabsTrigger
						value="all-pages"
						className="hover:cursor-pointer"
						disabled={isSearching}
					>
						All Pages
					</TabsTrigger>
					<TabsTrigger
						value="current-page"
						className="hover:cursor-pointer"
						disabled={isSearching}
					>
						Current Page
					</TabsTrigger>
					<TabsTrigger
						value="selection"
						className="hover:cursor-pointer"
						disabled={isSearching}
					>
						Selection
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
};

export default ScopeSelector;
