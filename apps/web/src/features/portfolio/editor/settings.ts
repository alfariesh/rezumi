import type { PortfolioRecord } from "./store";
import { usePortfolioEditorStore } from "./store";

export type SettingOptions = {
	/**
	 * Saves pending edits first and changes nothing when they can't be saved: publishing never puts a page live
	 * without the edits it shows (`02-teknis.md` 28). Other settings don't change what the page shows, so they go
	 * through whatever the save status.
	 */
	saveFirst?: boolean;
};

/**
 * Changes a setting that lives beside the data (published, search engines, source resume) and takes the server's
 * answer into the editor, keeping the data as edited. `unsaved`: `saveFirst` was asked and the edits aren't saved, so
 * the setting wasn't touched. Errors of the action itself are thrown.
 */
export async function changeSetting(
	action: () => Promise<PortfolioRecord>,
	options: SettingOptions = {},
): Promise<"changed" | "unsaved"> {
	if (options.saveFirst && !(await usePortfolioEditorStore.getState().flush())) return "unsaved";
	const record = await action();
	usePortfolioEditorStore.getState().applySettings(record);
	return "changed";
}
