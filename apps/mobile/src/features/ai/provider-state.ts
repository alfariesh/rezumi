import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { canUseRezumiAi } from "@/features/billing/ai-source";
import { usePlan } from "@/features/billing/plan";

/** Readiness is unknown on loading/error. Disabled (signed-out) queries never report loading. */
export function useHasAIProvider() {
	const session = useSession();
	const options = orpc.aiProviders.list.queryOptions();
	const query = useQuery({
		...options,
		queryKey: [...options.queryKey, session.server],
		enabled: session.status === "signed-in",
	});
	const plan = usePlan();
	const available = session.status === "signed-in" && query.isSuccess;
	// While the account chooses (its credits show), the server's AI is Rezumi AI: iOS never offers it.
	const choice = plan?.credits != null;
	const providers = (available ? query.data : []).filter(
		(provider) => !(provider.managed && choice && !canUseRezumiAi()),
	);
	const usableProviders = providers.filter((provider) => provider.enabled && provider.testStatus === "success");
	return {
		providers,
		usableProviders,
		// The server orders explicit default first, then most recently used runnable fallback.
		defaultProvider: usableProviders[0] ?? null,
		hasAIProvider: usableProviders.length > 0,
		/** Whether the account chooses between Rezumi AI (on Android) and its own connections. */
		choice,
		/** Spendable Rezumi AI credits, while the account chooses. */
		balance: plan?.credits?.balance ?? 0,
		isLoading: session.status === "signed-in" && query.isPending,
		isUnavailable: !available,
		error: query.error,
		retry: () => void query.refetch(),
	};
}
