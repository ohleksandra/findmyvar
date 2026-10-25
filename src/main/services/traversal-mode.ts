/**
 * Searching and the unused-variable scan both change `figma.skipInvisibleInstanceChildren`, and
 * they can run at the same time (e.g. a search on the Search tab while a scan runs). Each one
 * restoring "its" previous value would let a search switch hidden layers off in the middle of a
 * scan, and the scan would then report variables used only on hidden layers as unused.
 *
 * So both ask for a mode here instead. A full traversal (include hidden layers) always wins over a
 * fast one, and the user's original value comes back only when nobody needs either.
 */
export type TraversalMode = 'fast' | 'full';

let fullCount = 0;
let fastCount = 0;
let originalValue: boolean | null = null;

function apply(): void {
	if (fullCount > 0) {
		figma.skipInvisibleInstanceChildren = false;
	} else if (fastCount > 0) {
		figma.skipInvisibleInstanceChildren = true;
	} else if (originalValue !== null) {
		figma.skipInvisibleInstanceChildren = originalValue;
		originalValue = null;
	}
}

/** Switches to the given mode and returns a function that gives it back. Safe to call twice. */
export function acquireTraversalMode(mode: TraversalMode): () => void {
	if (fullCount === 0 && fastCount === 0) {
		originalValue = figma.skipInvisibleInstanceChildren;
	}
	if (mode === 'full') fullCount++;
	else fastCount++;
	apply();

	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (mode === 'full') fullCount--;
		else fastCount--;
		apply();
	};
}

/** Test helper: forget any outstanding modes. */
export function resetTraversalMode(): void {
	fullCount = 0;
	fastCount = 0;
	originalValue = null;
}
