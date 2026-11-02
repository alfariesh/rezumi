import { StandardRPCJsonSerializer } from "@orpc/client/standard";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";

const serializer = new StandardRPCJsonSerializer();

export const getQueryClient = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: 5 * 60 * 1000, // 5 minutes
				staleTime: 60 * 1000, // 1 minute
				queryKeyHashFn(queryKey) {
					const [json, meta] = serializer.serialize(queryKey);
					return JSON.stringify({ json, meta });
				},
			},
		},
		mutationCache: new MutationCache({
			// A plan limit or feature the plan lacks, wherever it came from, explains itself the same way.
			onError: (error) => {
				openPlanDialogForError(error);
			},
			onSettled: (_1, _2, _3, _4, _5, context) => {
				if (context?.meta?.noInvalidate) return;
				void queryClient.invalidateQueries({
					predicate: (query) => {
						const key = query.queryKey[0];
						return key !== "auth" && key !== "flags";
					},
				});
			},
		}),
	});

	return queryClient;
};
