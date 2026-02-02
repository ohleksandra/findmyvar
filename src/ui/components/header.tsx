import SearchControl from './search-control';
import { usePluginStore } from '@/store/plugin-store';
import { useShallow } from 'zustand/react/shallow';
import RecentSearchList from './recent-search-list';
import ScopeSelector from './scope-selector';

const Header = () => {
	const { recentSearches } = usePluginStore(
		useShallow((state) => ({
			searchResults: state.searchResults,
			recentSearches: state.recentSearches,
		})),
	);
	return (
		<div className="sticky top-0 flex flex-col w-full px-6 bg-[#F5F5F6] pt-6 pb-4 border-b ">
			<div className="flex flex-col gap-y-4">
				<SearchControl />
				{recentSearches.length > 0 && <RecentSearchList />}
				<ScopeSelector />
			</div>
		</div>
	);
};

export default Header;
