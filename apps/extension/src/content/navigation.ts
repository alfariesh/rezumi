/**
 * Calls `onChange` whenever the tab's address changes, including the in-page navigation of single-page boards
 * (LinkedIn, Glints and JobStreet switch postings without loading a page). The Navigation API reports most of them; a
 * throttled MutationObserver that compares `location.href` catches the rest. No `webNavigation`, `history` or `tabs`
 * permission is needed, so the browser never warns that the extension reads browsing history (02-teknis.md §7.3).
 */
export function watchAddress(onChange: (href: string) => void, { throttleMs = 250 } = {}) {
	let last = location.href;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const check = () => {
		timer = undefined;
		if (location.href === last) return;
		last = location.href;
		onChange(last);
	};
	const schedule = () => {
		timer ??= setTimeout(check, throttleMs);
	};

	const navigation = (globalThis as { navigation?: EventTarget }).navigation;
	navigation?.addEventListener("navigatesuccess", schedule);
	addEventListener("popstate", schedule);
	const observer = new MutationObserver(schedule);
	observer.observe(document, { childList: true, subtree: true });

	return () => {
		navigation?.removeEventListener("navigatesuccess", schedule);
		removeEventListener("popstate", schedule);
		observer.disconnect();
		if (timer) clearTimeout(timer);
	};
}
