import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src/ui'),
		},
	},
	test: {
		include: ['vitest/**/*.test.ts'],
		exclude: ['vitest/**/example.test.ts'],
	},
});
