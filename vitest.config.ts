import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['vitest/**/*.test.ts'],
		exclude: ['vitest/**/example.test.ts'],
	},
});
