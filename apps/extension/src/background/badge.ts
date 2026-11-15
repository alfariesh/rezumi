/**
 * The toolbar icon's badge (01-desain.md §5): a green check in a tab whose posting is saved; elsewhere a red count of
 * follow-ups due today or earlier. The title says which.
 */

export type Badge = { text: string; color: string; title: string };

const GREEN = "#16a34a";
const RED = "#dc2626";

const SAVED_TITLES = { en: "Rezumi: this job is saved", id: "Rezumi: loker ini sudah tersimpan" } as const;

function dueTitle(count: number, locale: "en" | "id") {
	if (locale === "id") return `Rezumi: ${count} tindak lanjut jatuh tempo`;
	return count === 1 ? "Rezumi: 1 follow-up due" : `Rezumi: ${count} follow-ups due`;
}

/** An empty title puts the manifest's default back. */
export function badgeFor({ saved, due, locale }: { saved: boolean; due: number; locale: "en" | "id" }): Badge {
	if (saved) return { text: "✓", color: GREEN, title: SAVED_TITLES[locale] };
	if (due > 0) return { text: due > 99 ? "99+" : String(due), color: RED, title: dueTitle(due, locale) };
	return { text: "", color: RED, title: "" };
}
