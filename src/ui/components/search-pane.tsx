import { usePluginStore } from '@/store/plugin-store';
import { useShallow } from 'zustand/react/shallow';
import ProgressPane from './progress-pane';
import Intro from './intro';
import SearchResult from './search-result';
import NoResults from './no-results';

const SearchPane = () => {
	const { isSearching, isSearchCompleted, searchResults } = usePluginStore(
		useShallow((state) => ({
			isSearching: state.isSearching,
			isSearchCompleted: state.isSearchCompleted,
			searchResults: state.searchResults,
		})),
	);

	return (
		<div className="flex flex-col overflow-y-auto z-10">
			{isSearching && <ProgressPane />}
			{!isSearching && !isSearchCompleted && <Intro />}
			{searchResults.length > 0 && <SearchResult />}
			{!isSearching && isSearchCompleted && searchResults.length === 0 && <NoResults />}
		</div>
	);
};

export default SearchPane;
