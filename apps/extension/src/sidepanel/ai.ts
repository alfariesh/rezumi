import type { RouterOutput } from "./api";
import type { AiSource, CreditAction } from "@rezumi/schema/billing";
import { CREDIT_COSTS } from "@rezumi/schema/billing";

/**
 * Which AI runs the panel's AI actions (02-teknis.md §10), the same rule as the web (apps/web/src/features/billing/
 * ai-source.ts): while plans apply and the server has its own AI, the person chooses between Rezumi AI (credits) and
 * their own connections; otherwise the server picks, and no credit detail shows. Pure, for tests.
 */

type Provider = Pick<RouterOutput["aiProviders"]["list"][number], "id" | "managed" | "enabled" | "testStatus">;
type Summary = Pick<RouterOutput["billing"]["summary"], "enabled" | "credits">;

export type AiChoice = {
	/** Whether the account chooses between Rezumi AI and its own connections; false hides every credit detail. */
	choice: boolean;
	/** Which AI runs the next action; null when there is none to run on. */
	source: AiSource | null;
	/** Spendable Rezumi AI credits, while the account chooses. */
	balance: number;
	/** Whether Rezumi AI's first use brings trial credits. */
	trial: boolean;
	/** The account has its own tested, switched-on connection (so it can pick it instead of Rezumi AI). */
	hasOwn: boolean;
};

const usable = (provider: Provider) => provider.enabled && provider.testStatus === "success";

export function aiChoice(
	summary: Summary | undefined,
	providers: readonly Provider[] | undefined,
	stored: AiSource | null,
): AiChoice {
	const list = providers ?? [];
	const managed = list.find((provider) => provider.managed && usable(provider));
	const own = list.filter((provider) => !provider.managed && usable(provider));
	const credits = summary?.enabled ? summary.credits : null;
	const choice = Boolean(credits && managed);
	const balance = credits?.balance ?? 0;
	const trial = Boolean(credits?.trial.available);
	if (!choice) return { choice, source: list.some(usable) ? "own" : null, balance, trial, hasOwn: own.length > 0 };
	// The server lists the default first: without a choice on this device, the default decides.
	const fallback: AiSource = list.find(usable)?.managed ? "rezumi" : "own";
	const source = stored === "rezumi" || (stored === "own" && own.length > 0) ? stored : fallback;
	return { choice, source, balance, trial, hasOwn: own.length > 0 };
}

/**
 * The fields that send one action to the chosen AI, with its own key so Rezumi AI takes credits once per action.
 * Nothing is added while the account doesn't choose (the server runs its default).
 */
export function aiFields(choice: Pick<AiChoice, "choice" | "source">, idempotencyKey: string) {
	if (!choice.choice || !choice.source) return {};
	return { aiSource: choice.source, idempotencyKey };
}

/** What an action costs on Rezumi AI: reading a posting is "short-text" (1), the AI match score "review" (4). */
export const creditCost = (action: CreditAction) => CREDIT_COSTS[action];

/** Whether the cost line shows: only while the account chooses and Rezumi AI runs the action. */
export const showsCredits = (choice: Pick<AiChoice, "choice" | "source">) =>
	choice.choice && choice.source === "rezumi";
