import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { callPlugin, rpcClient } from './lib/rpc-client';

rpcClient.init();

callPlugin('get-variables').then((response) => {
	console.log('Variables from main:', response);
});

window.addEventListener('beforeunload', () => {
	rpcClient.destroy();
});

createRoot(document.getElementById('app')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
