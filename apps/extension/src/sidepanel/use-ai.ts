import type { AiChoice } from "./ai";
import { useQuery } from "@tanstack/react-query";
import { aiChoice } from "./ai";
import { orpc } from "./api";
import { useSettings } from "./stores";

/** The account's AI choice (ai.ts) from its plan, its AI connections and the source picked on this device. */
export function useAiChoice(): AiChoice & { loading: boolean } {
	const summary = useQuery(orpc.billing.summary.queryOptions());
	const providers = useQuery(orpc.aiProviders.list.queryOptions({ input: {} }));
	const [settings] = useSettings();
	return {
		...aiChoice(summary.data, providers.data, settings?.aiSource ?? null),
		loading: summary.isPending || providers.isPending,
	};
}
