declare const IS_DEBUG: boolean;

const isDebugMode = IS_DEBUG;

export function isDebug(): boolean {
	return isDebugMode;
}

export const logger = {
	log: (...args: unknown[]) => {
		console.log(...args);
	},
	debug: (...args: unknown[]) => {
		if (isDebugMode) console.log(...args);
	},
	error: (...args: unknown[]) => {
		console.error(...args);
	},
	warn: (...args: unknown[]) => {
		if (isDebugMode) console.warn(...args);
	},
};

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	const remainingMs = ms % 1000;
	if (remainingMs === 0) return `${seconds}s`;
	return `${seconds}s ${remainingMs}ms`;
}
