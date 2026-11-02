import type { CreditAction } from "@rezumi/schema/billing";
import { plural, t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { Alert } from "react-native";
import { CAREER_TASK_CREDIT_ACTIONS, CREDIT_COSTS } from "@rezumi/schema/billing";
import { canShowPlans } from "./plan-alert";

// Kept apart from plan.ts and credits.ts, which read the API: the API client reads these and must not import itself.

const creditCount = (count: number) => plural(count, { one: "# credit", other: "# credits" });

/**
 * Store rules (00-keputusan-produk.md §6): Android offers Rezumi AI with its credits; iOS never does until In-App
 * Purchase exists, so it never sends work to Rezumi AI and only ever uses the user's own connection.
 */
export const canUseRezumiAi = canShowPlans;

const field = (input: unknown, name: string) =>
	input && typeof input === "object" ? (input as Record<string, unknown>)[name] : undefined;

/**
 * The kind of Rezumi AI work an API operation is, for its credit cost; null for AI work Rezumi AI doesn't run (voice,
 * schedules) and undefined for operations that aren't AI work.
 */
export function creditActionOf(operation: string, input: unknown): CreditAction | null | undefined {
	switch (operation) {
		case "ai.parsePdf":
		case "ai.parseDocx":
			return "import-document";
		case "ai.atsReview":
			return "review";
		case "ai.improve":
		case "applications.ai.parsePosting":
		case "applications.ai.autofill":
			return "short-text";
		case "applications.ai.matchScore":
			return "review";
		case "applications.ai.draftMessage":
			return field(input, "kind") === "cover-letter" ? "cover-letter" : "draft-answer";
		case "applications.ai.tailorResume":
			return "tailor-resume";
		case "coverLetters.draft":
			return "cover-letter";
		case "career.generate": {
			const task = field(field(input, "task"), "task");
			return typeof task === "string" && task in CAREER_TASK_CREDIT_ACTIONS
				? CAREER_TASK_CREDIT_ACTIONS[task as keyof typeof CAREER_TASK_CREDIT_ACTIONS]
				: "draft-answer";
		}
		case "agent.messages.send":
			return "coach-turn";
		case "career.voice.speak":
		case "career.voice.transcribe":
		case "career.saveSchedule":
			return null;
		default:
			return undefined;
	}
}

/** What an action costs on Rezumi AI, and what's left, in words for the confirmation before it runs. */
export const describeCreditCost = (action: CreditAction, balance: number) =>
	t`Rezumi AI: ${creditCount(CREDIT_COSTS[action])}, ${creditCount(balance)} left. If it fails, the credits come back.`;

/**
 * Too few Rezumi AI credits: names what's needed and the way on without credits. No price, link or button to buy
 * (Google Play rules); one plain sentence says where plans are sold. Only Android ever gets this error.
 */
export function showCreditsAlertForError(error: unknown) {
	if (!(error instanceof ORPCError) || error.code !== "INSUFFICIENT_CREDITS") return false;
	const data = (error.data ?? {}) as Record<string, unknown>;
	const required = creditCount(typeof data.required === "number" ? data.required : 0);
	const balance = creditCount(typeof data.balance === "number" ? data.balance : 0);
	Alert.alert(
		t`Not enough Rezumi AI credits`,
		`${t`This needs ${required} and you have ${balance}. Use your own AI connection instead: set it as the default in Settings → AI providers.`}\n\n${t`Plans can be bought on the rezumi.app website.`}`,
		[{ text: t`OK`, style: "cancel" }],
	);
	return true;
}
