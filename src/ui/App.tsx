import { useEffect } from 'react';
import { usePlugin } from '@/context/plugin-context';
import Header from './components/header';
import SearchPane from './components/search-pane';
import ErrorBoundary from './components/error-boundary';

const App = () => {
	const {
		actions: { getAllVariables },
	} = usePlugin();

	useEffect(() => {
		getAllVariables();
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
