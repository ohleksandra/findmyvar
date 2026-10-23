import { useEffect } from 'react';
import { usePlugin } from '@/context/plugin-context';
import { refreshOnReturn } from '@/lib/refresh-on-return';
import Header from './components/header';
import SearchPane from './components/search-pane';
import ErrorBoundary from './components/error-boundary';

const App = () => {
	const {
		actions: { getAllVariables },
	} = usePlugin();

	useEffect(() => {
		getAllVariables();
		// Undo in Figma can bring deleted variables back while the plugin is open.
		return refreshOnReturn(() => void getAllVariables());
	}, [getAllVariables]);

	return (
		<div className="grid grid-rows-[auto_1fr] h-full overflow-hidden">
			<Header />
			<ErrorBoundary>
				<SearchPane />
			</ErrorBoundary>
		</div>
	);
};

export default App;
