import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { refreshOnReturn } from '../src/ui/lib/refresh-on-return';

function fakeDocument(visibilityState: DocumentVisibilityState = 'visible') {
	return Object.assign(new EventTarget(), { visibilityState });
}

describe('refreshOnReturn', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('refreshes on focus or when visible again, at most once per interval', () => {
		const win = new EventTarget();
		const doc = fakeDocument();
		const refresh = vi.fn();
		refreshOnReturn(refresh, 2000, win, doc);

		win.dispatchEvent(new Event('focus'));
		expect(refresh).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2000);
		win.dispatchEvent(new Event('focus'));
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(refresh).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(2000);
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	test('skips while hidden and after it stops listening', () => {
		const win = new EventTarget();
		const doc = fakeDocument('hidden');
		const refresh = vi.fn();
		const stop = refreshOnReturn(refresh, 2000, win, doc);

		vi.advanceTimersByTime(2000);
		doc.dispatchEvent(new Event('visibilitychange'));
		expect(refresh).not.toHaveBeenCalled();

		doc.visibilityState = 'visible';
		stop();
		win.dispatchEvent(new Event('focus'));
		expect(refresh).not.toHaveBeenCalled();
	});
});
