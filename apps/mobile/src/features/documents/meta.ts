// The line under a document's name: "Resume · Edited 2 hours ago", or the days a trashed one has left. Relative times
// are Lingui plurals: Hermes has no `Intl.RelativeTimeFormat` (apps/mobile/AGENTS.md).
import type { DocumentSummary } from "./filter";
import { plural, t } from "@lingui/core/macro";
import { timeSinceParts } from "@rezumi/resume/sharing";
import { daysLeftInTrash } from "./filter";

export function editedAgo(date: Date, locale: string, now = Date.now()) {
	const { count, unit } = timeSinceParts(date, now);
	if (unit === "minute")
		return count < 1
			? t`Edited just now`
			: plural(count, { one: "Edited # minute ago", other: "Edited # minutes ago" });
	if (unit === "hour") return plural(count, { one: "Edited # hour ago", other: "Edited # hours ago" });
	if (unit === "day") return plural(count, { one: "Edited # day ago", other: "Edited # days ago" });
	const day = date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
	return t`Edited ${day}`;
}

export function documentMeta(document: DocumentSummary, locale: string, now = Date.now()) {
	const type = document.type === "resume" ? t`Resume` : t`Letter`;
	if (document.trashedAt) {
		const left = plural(daysLeftInTrash(document.trashedAt, now), { one: "# day left", other: "# days left" });
		return `${type} · ${left}`;
	}
	return `${type} · ${editedAgo(document.updatedAt, locale, now)}`;
}
