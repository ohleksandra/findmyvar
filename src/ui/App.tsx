import { useEffect } from 'react';
import { usePluginStore, initSearchListeners } from './store/plugin-store';
import SearchResult from './components/search-result';
import { useShallow } from 'zustand/react/shallow';
import Header from './components/header';
import Intro from './components/intro';
import ProgressPane from './components/progress-pane';
import { AnimatePresence } from 'motion/react';
import SearchPane from './components/search-pane';

const App = () => {
	const { fetchVariables, isSearching, isSearchCompleted } = usePluginStore(
		useShallow((state) => ({
			fetchVariables: state.getAllVariables,
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
		<div className="grid grid-rows-[auto_1fr] h-full overflow-hidden max-h-200">
			<Header />
			<SearchPane />
		</div>
	);
};

export default App;
