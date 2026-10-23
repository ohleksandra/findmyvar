type VisibilityTarget = EventTarget & Pick<Document, 'visibilityState'>;

/**
 * Calls `refresh` when the plugin window gets focus or becomes visible again, for example after an
 * undo in Figma, but at most once every `minIntervalMs`. Returns a function that stops listening.
 */
export function refreshOnReturn(
	refresh: () => void,
	minIntervalMs = 2000,
	win: EventTarget = window,
	doc: VisibilityTarget = document,
): () => void {
	// The caller has just loaded, so the first return within the interval is skipped too.
	let lastRefresh = Date.now();

	const onReturn = () => {
		if (doc.visibilityState === 'hidden') return;
		const now = Date.now();
		if (now - lastRefresh < minIntervalMs) return;
		lastRefresh = now;
		refresh();
	};

	win.addEventListener('focus', onReturn);
	doc.addEventListener('visibilitychange', onReturn);
	return () => {
		win.removeEventListener('focus', onReturn);
		doc.removeEventListener('visibilitychange', onReturn);
	};
}
