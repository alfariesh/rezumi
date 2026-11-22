// Write's actions over the open resume: a section by id, edits to its settings, sorting by date and unlocking.
import type { WriteSection } from "@/features/entries/model";
import type { SectionItem } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { sortSectionItemsByPeriod } from "@rezumi/resume/section-sort";
import { formatList } from "@rezumi/utils/locale";
import { client } from "@/api/client";
import { useResumeStore } from "@/draft";
import { resume } from "@/draft/runtime";
import { useEdit } from "@/features/entries/hooks";
import { getEntries, getSectionKind, getSectionObject, getSectionType } from "@/features/entries/model";
import { useWriteData } from "@/features/entries/source";
import { showToast } from "@/ui";

/** A section by id, as a stable object that changes only with its type; null once it's gone. */
export function useWriteSection(sectionId: string): WriteSection | null {
	const type = useWriteData((data) => getSectionType(data, sectionId) ?? null, null);
	return useMemo(() => (type ? { id: sectionId, kind: getSectionKind(sectionId), type } : null), [sectionId, type]);
}

type SectionSettings = NonNullable<ReturnType<typeof getSectionObject>>;

/** Changes a section's settings (title, icon, columns, hiding) as one undo step. */
export function useEditSection() {
	const edit = useEdit();
	return (section: WriteSection, mutate: (target: SectionSettings) => void) =>
		edit((draft) => {
			const target = getSectionObject(draft, section);
			if (target) mutate(target);
		});
}

type Sortable = SectionItem & { period: string; company?: string; school?: string };

/** Sort by date (experience and education). Entries whose dates can't be read stay at the end, named in a warning. */
export function useSortByDate() {
	const { t, i18n } = useLingui();
	const edit = useEdit();
	return (section: WriteSection) => {
		let unresolved: string[] = [];
		edit((draft) => {
			const entries = getEntries(draft, section) as never as Sortable[];
			const result = sortSectionItemsByPeriod(entries, draft.metadata.page.locale);
			unresolved = result.unresolvedIds.map((id) => {
				const entry = entries.find((item) => item.id === id);
				return (entry?.company || entry?.school || id).trim();
			});
			entries.splice(0, entries.length, ...result.items);
		});
		if (unresolved.length > 0) {
			const names = formatList(i18n.locale, unresolved);
			showToast({
				title: t`Couldn't read the dates on ${names}, so they stay at the end. Fix their dates and sort again.`,
				variant: "warning",
			});
		}
	};
}

/** Unlock: one tap and reversible (Lock is in the document menu). The draft reloads to pick it up. */
export function useUnlock() {
	const { t } = useLingui();
	return useMutation({
		mutationKey: ["write", "unlock"],
		mutationFn: async () => {
			const id = useResumeStore.getState().document?.id;
			if (id) await client.resume.setLocked({ id, isLocked: false });
		},
		onSuccess: () => resume.refresh(),
		onError: () => showToast({ title: t`Couldn't unlock this resume. Try again.`, variant: "danger" }),
	});
}
