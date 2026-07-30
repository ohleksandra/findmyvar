import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { rpcClient } from './lib/rpc-client';
import { PluginProvider } from './components/plugin-provider';

rpcClient.init();

window.addEventListener('beforeunload', () => {
	rpcClient.destroy();
});

createRoot(document.getElementById('app')!).render(
	<StrictMode>
		<PluginProvider>
			<App />
		</PluginProvider>
	</StrictMode>,
);
