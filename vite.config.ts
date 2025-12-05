/// <reference path="./src/vite-env.d.ts" />

import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ context }) => {
	return {
		plugins: context === 'ui' ? [react(), tailwindcss()] : [],
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src/ui'),
			},
		},
	};
});
