import SearchControl from './search-control';
import { usePlugin } from '@/context/plugin-context';
import RecentSearchList from './recent-search-list';
import ScopeSelector from './scope-selector';
import { useUnusedStore } from '@/store/unused-store';
import WorkspaceTabs from './workspace-tabs';

const Header = () => {
	const { state } = usePlugin();
	const { recentSearches } = state;
	const isSearchMode = !useUnusedStore((s) => s.isActive);
	return (
		<div className="sticky top-0 flex flex-col w-full bg-background border-b z-30">
			<WorkspaceTabs />
			<div className="flex flex-col px-4 pt-4 pb-3">
				<SearchControl />
				{isSearchMode && recentSearches.length > 0 && <RecentSearchList className="mt-3" />}
				{isSearchMode && <ScopeSelector className="mt-3" />}
			</div>
		</div>
	);
};

export default Header;
