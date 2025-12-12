import { useEffect } from 'react';
import { usePluginStore, initSearchListeners } from './store/plugin-store';
import SearchResult from './components/search-result';
import { useShallow } from 'zustand/react/shallow';
import Header from './components/header';
import Intro from './components/intro';

const App = () => {
	const { fetchVariables, isSearching, searchResults, isSearchCompleted } = usePluginStore(
		useShallow((state) => ({
			fetchVariables: state.fetchVariables,
			isSearching: state.isSearching,
			searchResults: state.searchResults,
			isSearchCompleted: state.isSearchCompleted,
		})),
	);

	// Init
	useEffect(() => {
		fetchVariables();

		const cleanup = initSearchListeners();
		return cleanup;
	}, [fetchVariables]);

	return (
		<div className="flex flex-col w-full h-screen overflow-hidden">
			<Header />
			{!isSearching && !isSearchCompleted && <Intro />}
			{(isSearching || isSearchCompleted) && <SearchResult />}
		</div>
	);
};

export default App;
