// One line on what a saved item used and one paragraph on what it says, from its stored structure (no prose parsing,
// works without AI).
import type { SavedItem } from "../queries";
import type { IconName } from "@/ui";
import type { SavedItemKind, WorkspaceTab } from "@rezumi/schema/career";
import { plural, t } from "@lingui/core/macro";
import { formatMoney } from "../money";

export const KINDS: { kind: SavedItemKind; icon: IconName; tab: WorkspaceTab | null }[] = [
	{ kind: "fit", icon: "list-checks", tab: "fit" },
	{ kind: "briefing", icon: "clipboard-text", tab: "prepare" },
	{ kind: "practice", icon: "user-sound", tab: "practise" },
	{ kind: "debrief", icon: "chat-centered-text", tab: "debrief" },
	{ kind: "answers", icon: "pencil-line", tab: "apply" },
	{ kind: "reply", icon: "envelope-simple", tab: "messages" },
	{ kind: "offer", icon: "scales", tab: null },
];

/** "3 facts, 2 stories, posting": what the coach read to write it. */
export function sourcesOf(item: SavedItem) {
	const parts: string[] = [];
	const facts = item.evidence.factIds.length;
	const stories = item.evidence.storyIds.length;
	if (facts) parts.push(plural(facts, { one: "# fact", other: "# facts" }));
	if (stories) parts.push(plural(stories, { one: "# story", other: "# stories" }));
	const kind = item.data.kind;
	if (kind === "fit" || kind === "briefing") parts.push(t`posting`);
	if (kind === "debrief") parts.push(t`your notes`);
	if (kind === "reply" || kind === "offer") parts.push(t`the message`);
	return parts.join(", ");
}

export function summaryOf(item: SavedItem, locale: string): string {
	const data = item.data;
	switch (data.kind) {
		case "fit": {
			const count = (status: string) => data.requirements.filter((requirement) => requirement.status === status).length;
			const supported = count("supported");
			const partial = count("partial");
			const missing = count("missing");
			const summary = data.summary;
			return t`${supported} supported, ${partial} partly supported, ${missing} with no evidence yet. ${summary}`;
		}
		case "briefing":
			return [data.focus, data.honesty].filter(Boolean).join(" ");
		case "practice":
			return [data.works, data.strengthen].filter(Boolean).join(" ");
		case "debrief":
			return [data.nextRound, data.priority].filter(Boolean).join(" ");
		case "answers":
			return `${plural(data.answers.length, { one: "# answer", other: "# answers" })}: ${data.answers.map((answer) => answer.question).join(" · ")}`;
		case "reply":
			return [...data.asks, ...data.unconfirmed].join(" ");
		case "offer": {
			const base = data.base === null ? null : formatMoney(locale, data.currency, data.base);
			return [base, data.location, data.leave].filter(Boolean).join(" · ");
		}
	}
}
