import type { RouterOutput } from "@/libs/orpc/client";
import type { AiSource, CreditAction } from "@rezumi/schema/billing";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand/react";
import { CREDIT_COSTS } from "@rezumi/schema/billing";
import { generateId } from "@rezumi/utils/string";
import { usePlan } from "./plan";
import { orpc } from "@/libs/orpc/client";

type Provider = RouterOutput["aiProviders"]["list"][number];

const STORAGE_KEY = "rezumi:ai-source";

function readStoredSource(): AiSource | null {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === "rezumi" || value === "own" ? value : null;
	} catch {
		return null;
	}
}

/** The source this browser last chose; without one, the account's default connection decides. */
const useStoredSource = create<{ source: AiSource | null }>(() => ({ source: readStoredSource() }));

/** Chooses which AI runs actions from now on, in this browser. */
export function chooseAiSource(source: AiSource) {
	useStoredSource.setState({ source });
	try {
		localStorage.setItem(STORAGE_KEY, source);
	} catch {
		// A blocked storage keeps the choice for this visit only.
	}
}

const usable = (provider: Provider) => provider.enabled && provider.testStatus === "success";

export type AiSourceState = {
	/** Whether the account chooses between Rezumi AI and its own connections; false hides every credit detail. */
	choice: boolean;
	/** Which AI runs the next action; null when there's none to run on. */
	source: AiSource | null;
	/** Spendable Rezumi AI credits, while the account chooses. */
	balance: number;
	/** Rezumi AI, when the server offers it to this account. */
	managed: Provider | undefined;
	/** The user's own tested, switched-on connections, default first. */
	own: Provider[];
};

/**
 * Which AI runs the user's AI actions. While plans apply and the server has its own AI, the user chooses between Rezumi
 * AI (paid with credits) and their own connections; otherwise the server picks, as before plans existed.
 */
export function useAiSource(): AiSourceState {
	const plan = usePlan();
	const providers = useQuery(orpc.aiProviders.list.queryOptions()).data ?? [];
	const stored = useStoredSource((state) => state.source);
	const managed = providers.find((provider) => provider.managed && usable(provider));
	const own = providers.filter((provider) => !provider.managed && usable(provider));
	const choice = Boolean(plan?.credits && managed);
	const balance = plan?.credits?.balance ?? 0;
	if (!choice) return { choice, source: providers.some(usable) ? "own" : null, balance, managed, own };
	// The server lists the default first: without a choice in this browser, the default decides.
	const fallback: AiSource = providers.find(usable)?.managed ? "rezumi" : "own";
	const source = stored === "rezumi" || (stored === "own" && own.length > 0) ? stored : fallback;
	return { choice, source, balance, managed, own };
}

/**
 * The fields that send one action to the chosen AI. Each call is a new action with a new key: Rezumi AI takes its
 * credits once per key. Nothing is added while the account doesn't choose.
 */
export function aiSourceFields(state: Pick<AiSourceState, "choice" | "source">) {
	if (!state.choice || !state.source) return {};
	return { aiSource: state.source, idempotencyKey: generateId() };
}

/** The fields for an action on a connection the user picked by ID: Rezumi AI when they picked it. */
export function aiSourceFieldsFor(state: Pick<AiSourceState, "choice" | "managed">, providerId: string | undefined) {
	if (!state.choice || !providerId) return {};
	return { aiSource: providerId === state.managed?.id ? "rezumi" : "own", idempotencyKey: generateId() } as const;
}

/** What an action costs on Rezumi AI. */
export const creditCost = (action: CreditAction) => CREDIT_COSTS[action];
