import SearchControl from './search-control';
import { usePlugin } from '@/context/plugin-context';
import RecentSearchList from './recent-search-list';
import ScopeSelector from './scope-selector';

const Header = () => {
	const { state } = usePlugin();
	const { recentSearches } = state;
	return (
		<div className="sticky top-0 flex flex-col w-full px-6 bg-[#F5F5F6] pt-6 pb-4 border-b z-30">
			<div className="flex flex-col">
				<SearchControl />
				{recentSearches.length > 0 && <RecentSearchList className="mt-2" />}
				<ScopeSelector className="mt-4" />
			</div>
		</div>
	);
};

export default Header;
