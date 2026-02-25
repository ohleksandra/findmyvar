/// <reference path="./src/vite-env.d.ts" />

import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig(({ context }) => {
	return {
		plugins: context === 'ui' ? [react(), tailwindcss()] : [],
		define:
			context === 'ui'
				? {}
				: {
						IS_DEBUG: JSON.stringify(isDev),
					},
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src/ui'),
			},
		},
	};
});
