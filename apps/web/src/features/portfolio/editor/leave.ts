import { t } from "@lingui/core/macro";
import { usePortfolioEditorStore } from "./store";

/** How long leaving waits for the save on its way before asking; the save carries on either way. */
export const LEAVE_SAVE_TIMEOUT_MS = 10_000;

type ConfirmOptions = { description: string; confirmText: string; cancelText: string };

/** Asks a yes-or-no question (`useConfirm`); true is yes. */
type Confirm = (title: string, options: ConfirmOptions) => Promise<boolean>;

/**
 * Whether leaving the editor waits. What's pending is saved first; when that can't be done (or takes too long), the
 * person decides: stay to fix it or try again, or leave without it. Nobody is kept in the editor by a save that can't
 * succeed, such as one for a portfolio deleted in another tab. True means stay.
 */
export async function shouldStayInEditor(confirm: Confirm): Promise<boolean> {
	const { status, dirty } = usePortfolioEditorStore.getState();
	if (status === "saved" && !dirty) return false;

	let timeout: ReturnType<typeof setTimeout> | undefined;
	const saved = await Promise.race([
		usePortfolioEditorStore.getState().flush(),
		new Promise<boolean>((resolve) => {
			timeout = setTimeout(() => resolve(false), LEAVE_SAVE_TIMEOUT_MS);
		}),
	]);
	clearTimeout(timeout);
	if (saved) return false;

	const leave = await confirm(t`Leave without saving?`, {
		description: t`Your latest changes aren't saved. If you leave now, they're lost.`,
		confirmText: t`Leave without saving`,
		cancelText: t`Keep editing`,
	});
	return !leave;
}
