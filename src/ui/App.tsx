import { useEffect } from 'react';
import PluginSidebar from './components/plugin-sidebar';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar';
import WelcomePane from './components/welcome-pane';
import { usePluginStore } from './store/plugin-store';

const App = () => {
	const fetchVariables = usePluginStore((state) => state.fetchVariables);

	// Init
	useEffect(() => {
		fetchVariables();
	}, [fetchVariables]);

	return (
		<SidebarProvider open={true}>
			<PluginSidebar />
			<SidebarInset>
				<main className="h-full flex">
					<WelcomePane className="my-auto" />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
};

export default App;
