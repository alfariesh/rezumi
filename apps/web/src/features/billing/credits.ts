import type { RouterOutput } from "@/libs/orpc/client";
import type { IconName } from "@rezumi/ui/components/icon";
import { plural, t } from "@lingui/core/macro";

export type CreditHistoryEntry = RouterOutput["billing"]["creditHistory"]["items"][number];

/** How many Rezumi AI credits, in words. */
export const creditCount = (count: number) => plural(count, { one: "# credit", other: "# credits" });

/** The kind of Rezumi AI work behind a credit charge, in words. */
export function getCreditActionName(action: string) {
	switch (action) {
		case "short-text":
			return t`Short text help`;
		case "draft-answer":
			return t`Answer draft`;
		case "cover-letter":
			return t`Cover letter draft`;
		case "interview-practice":
			return t`Interview practice`;
		case "coach-turn":
			return t`Coach`;
		case "review":
			return t`Resume review`;
		case "tailor-resume":
			return t`Resume tailoring`;
		case "import-document":
			return t`Import with AI`;
		case "portfolio-draft":
			return t`Portfolio draft`;
		case "portfolio-rewrite":
			return t`Portfolio rewrite`;
		case "portfolio-metrics":
			return t`Numbers found for your portfolio`;
		case "profile-website":
			return t`Website read into your Profile`;
		case "admin-adjustment":
			return t`Correction by Rezumi`;
		default:
			return "Rezumi AI";
	}
}

/** One line of credit history: what came in or went out, and where it stands. */
export function describeCreditEntry(
	entry: CreditHistoryEntry,
	formatDate: (date: Date) => string,
	now = new Date(),
): { icon: IconName; title: string; detail: string; amount: string } {
	if (entry.type === "grant") {
		const title =
			entry.source === "trial" ? t`Trial credits` : entry.source === "plan" ? t`Pro AI credits` : t`Added by Rezumi`;
		const expires = formatDate(entry.expiresAt);
		const left = entry.remaining;
		const detail = entry.revokedAt
			? t`Taken back on ${formatDate(entry.revokedAt)}`
			: entry.expiresAt <= now
				? t`Expired on ${expires}`
				: left < entry.amount
					? plural(left, { one: `# left, expires on ${expires}`, other: `# left, expires on ${expires}` })
					: t`Expires on ${expires}`;
		return { icon: "plus-circle", title, detail, amount: `+${entry.amount}` };
	}
	const title = getCreditActionName(entry.action);
	const amount = `−${entry.credits}`;
	if (entry.status === "reserved") return { icon: "hourglass", title, detail: t`In progress`, amount };
	if (entry.status === "released")
		return { icon: "arrow-counter-clockwise", title, detail: t`Returned: no usable result`, amount };
	const at = formatDate(entry.at);
	if (entry.action === "admin-adjustment") return { icon: "minus", title, detail: t`Taken away on ${at}`, amount };
	return { icon: "sparkle", title, detail: t`Used on ${at}`, amount };
}
