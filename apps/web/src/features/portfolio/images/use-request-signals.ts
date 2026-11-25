import { useEffect, useRef } from "react";

/**
 * Abort signals for requests whose answer belongs to the component (a dialog, a menu waiting for the AI):
 * `next(name)` cancels the request running under that name and gives the next one its signal, and every request is
 * cancelled when the component goes away (a dialog closed), so nothing it started acts afterwards. `cancel(name)` stops
 * one early. Work for a place in the portfolio that should finish anyway (uploads) uses `runPortfolioTask` instead.
 */
export function useRequestSignals() {
	const controllers = useRef(new Map<string, AbortController>());

	useEffect(() => {
		const running = controllers.current;
		return () => {
			for (const controller of running.values()) controller.abort();
			running.clear();
		};
	}, []);

	return {
		next: (name = "request"): AbortSignal => {
			controllers.current.get(name)?.abort();
			const controller = new AbortController();
			controllers.current.set(name, controller);
			return controller.signal;
		},
		cancel: (name = "request") => {
			controllers.current.get(name)?.abort();
			controllers.current.delete(name);
		},
	};
}
