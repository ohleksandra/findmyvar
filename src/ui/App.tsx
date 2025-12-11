import { useEffect } from 'react';
import { usePluginStore, initSearchListeners } from './store/plugin-store';

const App = () => {
	const fetchVariables = usePluginStore((state) => state.fetchVariables);

	// Init
	useEffect(() => {
		fetchVariables();

		const cleanup = initSearchListeners();
		return cleanup;
	}, [fetchVariables]);

	return <>Test</>;
};

export default App;
