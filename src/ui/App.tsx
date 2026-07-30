import { useEffect } from 'react';
import { usePlugin } from '@/context/plugin-context';
import Header from './components/header';
import SearchPane from './components/search-pane';

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
			<SearchPane />
		</div>
	);
};

export default App;
