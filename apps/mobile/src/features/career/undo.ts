import { t } from "@lingui/core/macro";
import { AppState } from "react-native";
import { hideToast, showToast, toastLifetime } from "@/ui";

type UndoOptions = { message: string; commit: () => Promise<unknown>; restore: () => void; failed: () => void };

/**
 * Hides at once and commits when the Undo toast's time is up (the toast has no close callback, so this keeps its own
 * timer). Backgrounding the app commits first, before JavaScript is suspended.
 */
export function withUndo({ message, commit, restore, failed }: UndoOptions) {
	let settled = false;
	const finish = (apply: boolean) => {
		if (settled) return;
		settled = true;
		clearTimeout(timer);
		listener.remove();
		if (toast) hideToast(toast);
		if (apply)
			void Promise.resolve()
				.then(commit)
				.catch(() => {
					restore();
					failed();
				});
		else restore();
	};
	const timer = setTimeout(() => finish(true), toastLifetime());
	const listener = AppState.addEventListener("change", (state) => {
		if (state === "background") finish(true);
	});
	const toast = showToast({ title: message, undo: { label: t`Undo`, onUndo: () => finish(false) } });
	return { flush: () => finish(true), cancel: () => finish(false) };
}
