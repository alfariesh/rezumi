/** What keeping the open work and the editor's tab together asks for after a change of either. */
export type WorkModeStep = { kind: "open"; workId: string | null } | { kind: "switch-to-work" } | { kind: "none" };

type WorkModeInput = {
	/** The tab before this change; null when the editor has just opened. */
	before: string | null;
	mode: string;
	openWorkId: string | null;
	/** The work open last in Work. */
	lastWorkId: string | null;
	workIds: readonly string[];
};

/**
 * Work and the open work go together. Leaving Work closes the work, so the other tabs' preview shows the home page.
 * Arriving in Work (from the rail, or with the editor opened on it) opens the work open last, else the first. A work
 * opened while another tab shows (a card in the preview, a new work, "Show me") brings Work up.
 */
export function workModeStep({ before, mode, openWorkId, lastWorkId, workIds }: WorkModeInput): WorkModeStep {
	if (before === "work" && mode !== "work") return { kind: "open", workId: null };
	if (mode === "work" && before !== "work" && !openWorkId) {
		const pick = workIds.find((id) => id === lastWorkId) ?? workIds[0];
		return pick ? { kind: "open", workId: pick } : { kind: "none" };
	}
	if (mode !== "work" && openWorkId) return { kind: "switch-to-work" };
	return { kind: "none" };
}
