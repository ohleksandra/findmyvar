import PluginSidebar from './components/plugin-sidebar';
import { SidebarInset, SidebarProvider } from './components/ui/sidebar';
import WelcomePane from './components/welcome-pane';

const App = () => {
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
