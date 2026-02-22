import { useEffect } from 'react';
import { usePluginStore, initSearchListeners } from './store/plugin-store';
import { useShallow } from 'zustand/react/shallow';
import Header from './components/header';
import SearchPane from './components/search-pane';

const App = () => {
	const { fetchVariables } = usePluginStore(
		useShallow((state) => ({
			fetchVariables: state.getAllVariables,
			isSearching: state.isSearching,
			searchResults: state.searchResults,
			isSearchCompleted: state.isSearchCompleted,
		})),
	);

	useEffect(() => {
		fetchVariables();
		const cleanup = initSearchListeners();
		return cleanup;
	}, [fetchVariables]);

	return (
		<div className="grid grid-rows-[auto_1fr] h-full overflow-hidden">
			<Header />
			<SearchPane />
		</div>
	);
};

export default App;
