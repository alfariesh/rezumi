import type { CheckIssue } from "./messages";
import type { CheckTarget } from "@rezumi/resume/check";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { checkStateOf, getFindingField, ignoreIssue, runCheck } from "@rezumi/resume/check";
import { useResumeStore } from "@/draft";
import { routes } from "@/routes";
import { hideToast, showToast, toastLifetime } from "@/ui";

type Edit = (draft: ResumeData) => void;

/**
 * One undo step on the builder's draft, confirmed in a toast whose Undo takes it back. Undo only applies while that
 * edit is still the latest, so a toast never undoes a later, unrelated edit. False when nothing changed.
 */
export function editWithUndo(id: string, edit: Edit, message: string, undoLabel: string, staleMessage: string) {
	const store = useResumeStore.getState();
	if (store.document?.id !== id || !store.data || store.locked) return false;
	store.update(edit, { newStep: true });
	const changed = useResumeStore.getState().data;
	if (changed === store.data) return false;

	const toastId = showToast({
		title: message,
		undo: {
			label: undoLabel,
			onUndo: () => {
				const current = useResumeStore.getState();
				if (current.document?.id === id && current.data === changed && !current.locked) current.undo();
				else showToast({ title: staleMessage });
			},
		},
	});
	// A later edit retires the toast: its Undo would no longer mean this edit.
	const unsubscribe = useResumeStore.subscribe((current) => {
		if (current.document?.id === id && current.data === changed) return;
		hideToast(toastId);
		unsubscribe();
	});
	setTimeout(unsubscribe, toastLifetime());
	return true;
}

/** Where Write opens an issue's field: the basics, the summary, an entry, or the outline for a whole section. */
export function writeHref(id: string, target: CheckTarget) {
	if (target.kind === "header") return routes.entry(id, "basics", "basics");
	if (target.kind === "item") return routes.entry(id, target.sectionId, target.itemId);
	if (target.sectionId === "summary") return routes.entry(id, "summary", "summary");
	return routes.builder(id, "write");
}

/** What a Check card can do: fix in one step, open the field in Write, or set the issue aside. */
export function useCheckActions(id: string) {
	const router = useRouter();
	const { t } = useLingui();
	const undoLabel = t`Undo`;
	const stale = t`Use the builder's Undo to undo earlier changes.`;
	const edit = (recipe: Edit, message: string) => editWithUndo(id, recipe, message, undoLabel, stale);

	const fix = (issue: CheckIssue) => {
		const current = useResumeStore.getState();
		if (current.document?.id !== id || !current.data) return;
		// Find the issue again by its stable key: array pointers can move after a reorder or a remote edit.
		const fresh = runCheck(current.data).issues.find((entry) => entry.key === issue.key);
		if (!fresh) return;
		if (fresh.fix.kind === "apply") {
			if (!current.locked) edit(fresh.fix.apply, t`${issue.done}. Issue resolved.`);
			return;
		}
		router.push({
			pathname: writeHref(id, fresh.fix.target),
			params: { field: getFindingField(fresh.finding.pointer) },
		});
	};

	const ignore = (issue: CheckIssue) =>
		edit((draft) => ignoreIssue(draft, issue.key), issue.keepLabel ? t`Kept as it is` : t`Issue ignored`);

	const restoreIgnored = () =>
		edit(
			(draft) => {
				checkStateOf(draft).ignored = [];
			},
			t`Ignored issues are back`,
		);

	return { fix, ignore, restoreIgnored, edit };
}
