import { useEffect } from 'react';
import { usePluginStore, initSearchListeners } from './store/plugin-store';
import Header from './components/header';
import SearchPane from './components/search-pane';

const App = () => {
	const fetchVariables = usePluginStore((state) => state.getAllVariables);

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
