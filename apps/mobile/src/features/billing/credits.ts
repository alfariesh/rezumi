import type { RouterOutput } from "@/api/client";
import type { IconName } from "@/ui";
import { plural, t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";

export type CreditHistoryEntry = RouterOutput["billing"]["creditHistory"]["items"][number];

const recent = { limit: 5 } as const;

/** The account's latest credit activity, for the plan screen. Off while credits don't apply to the account. */
export function useRecentCredits(enabled: boolean) {
	const session = useSession();
	return useQuery(
		orpc.billing.creditHistory.queryOptions({
			input: recent,
			queryKey: [...orpc.billing.creditHistory.key({ input: recent }), session.server],
			enabled: enabled && session.status === "signed-in",
			retry: false,
		}),
	).data;
}

/** How many Rezumi AI credits, in words. */
export const creditCount = (count: number) => plural(count, { one: "# credit", other: "# credits" });

function actionName(action: string) {
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
	const title = actionName(entry.action);
	const amount = `−${entry.credits}`;
	if (entry.status === "reserved") return { icon: "hourglass", title, detail: t`In progress`, amount };
	if (entry.status === "released")
		return { icon: "arrow-counter-clockwise", title, detail: t`Returned: no usable result`, amount };
	const at = formatDate(entry.at);
	if (entry.action === "admin-adjustment") return { icon: "minus", title, detail: t`Taken away on ${at}`, amount };
	return { icon: "sparkle", title, detail: t`Used on ${at}`, amount };
}
