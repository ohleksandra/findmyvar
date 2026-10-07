import { usePlugin } from '@/context/plugin-context';
import ProgressPane from './progress-pane';
import Intro from './intro';
import SearchResult from './search-result';
import NoResults from './no-results';

type SearchStatus = 'idle' | 'searching' | 'has-results' | 'empty';

function deriveStatus(
	isSearching: boolean,
	isSearchCompleted: boolean,
	resultCount: number,
): SearchStatus {
	if (isSearching) return 'searching';
	if (isSearchCompleted && resultCount === 0) return 'empty';
	if (resultCount > 0) return 'has-results';
	return 'idle';
}

const SearchPane = () => {
	const { state } = usePlugin();
	const status = deriveStatus(
		state.isSearching,
		state.isSearchCompleted,
		state.searchResults.length,
	);

	if (state.error && !state.isSearching && state.searchResults.length === 0) {
		return (
			<div className="flex flex-col w-full h-full justify-center items-center px-6">
				<div className="flex flex-col justify-center gap-y-2 max-w-79.5 items-center">
					<p className="font-medium text-nowrap">Something went wrong</p>
					<p className="text-center leading-5 text-sm break-words">{state.error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col overflow-y-auto z-10">
			{status === 'searching' && <ProgressPane />}
			{status === 'idle' && <Intro />}
			{status === 'has-results' && <SearchResult />}
			{status === 'empty' && <NoResults />}
		</div>
	);
};

export default SearchPane;
