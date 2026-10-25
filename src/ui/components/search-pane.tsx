import { usePlugin } from '@/context/plugin-context';
import ProgressPane from './progress-pane';
import Intro from './intro';
import SearchResult from './search-result';
import NoResults from './no-results';
import SearchStopped from './search-stopped';
import UnusedPane from './unused/unused-pane';
import { useUnusedStore } from '@/store/unused-store';

type SearchStatus = 'idle' | 'searching' | 'has-results' | 'empty' | 'stopped';

function deriveStatus(
	isSearching: boolean,
	isSearchCompleted: boolean,
	isSearchCancelled: boolean,
	resultCount: number,
): SearchStatus {
	if (isSearching) return 'searching';
	if (isSearchCancelled && resultCount === 0) return 'stopped';
	if (isSearchCompleted && resultCount === 0) return 'empty';
	if (resultCount > 0) return 'has-results';
	return 'idle';
}

const SearchPane = () => {
	const { state } = usePlugin();
	const isUnusedOpen = useUnusedStore((s) => s.isActive);
	const status = deriveStatus(
		state.isSearching,
		state.isSearchCompleted,
		state.isSearchCancelled,
		state.searchResults.length,
	);

	if (isUnusedOpen) {
		return (
			<div className="flex flex-col overflow-y-auto z-10">
				<UnusedPane />
			</div>
		);
	}

	if (state.error && !state.isSearching && state.searchResults.length === 0) {
		return (
			<div className="flex flex-col w-full h-full justify-center items-center px-4">
				<div className="flex flex-col justify-center gap-y-2 max-w-64 items-center">
					<p className="text-heading-small font-strong text-nowrap">
						Something went wrong
					</p>
					<p className="text-center text-muted-foreground break-words">{state.error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col overflow-y-auto z-10">
			{state.isSearching && <ProgressPane />}
			{state.searchResults.length > 0 && <SearchResult />}
			{status === 'idle' && <Intro />}
			{status === 'empty' && <NoResults />}
			{status === 'stopped' && <SearchStopped />}
		</div>
	);
};

export default SearchPane;
