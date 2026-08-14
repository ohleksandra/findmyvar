import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { rpcClient } from './lib/call-plugin';
import { PluginProvider } from './components/plugin-provider';
import ErrorBoundary from './components/error-boundary';

console.log('[UI] ui.tsx loaded');
rpcClient.init();

window.addEventListener('beforeunload', () => {
	rpcClient.destroy();
});

createRoot(document.getElementById('app')!).render(
	<StrictMode>
		<ErrorBoundary>
			<PluginProvider>
				<App />
			</PluginProvider>
		</ErrorBoundary>
	</StrictMode>,
);
