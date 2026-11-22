// Data for the application workspace (web career/hooks.ts). Query keys append the server origin, as the other
// features do, and stay under the oRPC prefixes so Career writes refresh them. AI work (`career.generate`) goes through
// the client's per-operation consent (src/api/ai-consent.ts) before anything is sent.
import type { SaveResult } from "./state";
import type { RouterOutput } from "@/api/client";
import type { CareerWorkspace, GenerateTask } from "@rezumi/schema/career";
import type { QueryClient } from "@tanstack/react-query";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EMPTY_WORKSPACE } from "@rezumi/schema/career";
import { saveFailure } from "./state";
import { orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/providers";
import { haptics, showToast } from "@/ui";

export type SavedItem = RouterOutput["career"]["savedItems"][number];
export type SavedData<K extends SavedItem["data"]["kind"]> = Extract<SavedItem["data"], { kind: K }>;
export type Fact = RouterOutput["career"]["facts"][number];

/** The server's own message when it explains the problem (web `allowServerMessage`), otherwise `fallback`. */
export function workspaceError(error: unknown, fallback: string) {
	if (error instanceof ORPCError && error.message && error.code !== "INTERNAL_SERVER_ERROR") return error.message;
	return fallback;
}

/** Declining the AI consent sends nothing and needs no message; too few credits has the client's own alert. */
export function isQuietAiError(error: unknown) {
	return (
		(error instanceof Error && error.name === "AbortError") ||
		(error instanceof ORPCError && error.code === "INSUFFICIENT_CREDITS")
	);
}

function useSignedIn() {
	const session = useSession();
	return { server: session.server, enabled: session.status === "signed-in" };
}

const workspaceKey = (applicationId: string, server: string) => [
	...orpc.career.workspace.queryKey({ input: { applicationId } }),
	server,
];

const workspaceWrites = new WeakMap<QueryClient, Map<string, Set<Promise<unknown>>>>();

/**
 * One application's live workspace state. Saves are optimistic and run one at a time per application; a failure
 * explains the problem and refetches once queued writes finish, while text fields keep their local drafts.
 */
export function useWorkspace(applicationId: string) {
	const queryClient = useQueryClient();
	const { server, enabled } = useSignedIn();
	const queryKey = workspaceKey(applicationId, server);
	const query = useQuery({ ...orpc.career.workspace.queryOptions({ input: { applicationId } }), queryKey, enabled });
	let byApplication = workspaceWrites.get(queryClient);
	if (!byApplication) workspaceWrites.set(queryClient, (byApplication = new Map()));
	const scope = `${server}:${applicationId}`;
	let writes = byApplication.get(scope);
	if (!writes) byApplication.set(scope, (writes = new Set()));
	const pending = writes;
	const mutation = useMutation({
		...orpc.career.saveWorkspace.mutationOptions(),
		// One at a time per application, and no refetch between them: a refetch landing between two quick ticks would
		// hand the second save a copy without the first.
		scope: { id: `career-workspace:${scope}` },
		onError: (error) =>
			showToast({
				title: workspaceError(error, t`Couldn't save that change. Check your connection and try again.`),
				variant: "danger",
			}),
	});
	const current = () => queryClient.getQueryData<CareerWorkspace>(queryKey) ?? EMPTY_WORKSPACE;
	/** Resolves once the server confirmed the change, or with why it failed (already reported). Never rejects. */
	const save = (patch: Partial<CareerWorkspace>): Promise<SaveResult> => {
		if (getServer() !== server) return Promise.resolve({ ok: false, transient: false, code: "SERVER_CHANGED" });
		const previous = current();
		const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
		const expected = Object.fromEntries(
			Object.keys(defined).map((key) => [key, previous[key as keyof CareerWorkspace]]),
		);
		// Capture and publish synchronously, so another control's immediate write builds on this one.
		void queryClient.cancelQueries({ queryKey });
		queryClient.setQueryData(queryKey, { ...previous, ...defined });
		const write = mutation.mutateAsync({ applicationId, ...defined, expected });
		pending.add(write);
		return write.then(
			(): SaveResult => {
				pending.delete(write);
				return { ok: true };
			},
			(error: unknown) => {
				pending.delete(write);
				void Promise.allSettled(pending).then(() => queryClient.invalidateQueries({ queryKey }));
				return saveFailure(error);
			},
		);
	};
	return {
		data: query.data ?? EMPTY_WORKSPACE,
		query,
		isPending: query.isPending,
		/** The latest copy, including saves still in flight, for a change that commits later (after an Undo toast). */
		current,
		save,
		/** A copy the server confirmed: queued writes finish, then a fresh fetch replaces the cache. Rejects offline. */
		fetchConfirmed: async () => {
			while (pending.size > 0) await Promise.allSettled(pending);
			return queryClient.fetchQuery({
				...orpc.career.workspace.queryOptions({ input: { applicationId } }),
				queryKey,
				staleTime: 0,
			});
		},
		/** Finish queued writes before an action that reads the authoritative workspace. */
		settled: async () => {
			while (pending.size > 0) await Promise.allSettled(pending);
			return current();
		},
		queryKey,
	};
}

export type Workspace = ReturnType<typeof useWorkspace>;

/** Toggles one row of a ticked list in the workspace ("plan:{id}", "now:{interviewId}", "week:{id}"). */
export function useTicks(applicationId: string, key: string) {
	const workspace = useWorkspace(applicationId);
	return {
		ticked: workspace.data.ticks[key] ?? [],
		toggle: (row: string, on: boolean) => {
			const ticks = workspace.current().ticks;
			const rows = ticks[key] ?? [];
			void workspace.save({
				ticks: { ...ticks, [key]: on ? [...new Set([...rows, row])] : rows.filter((item) => item !== row) },
			});
		},
	};
}

export function useSavedItems(applicationId: string) {
	const { server, enabled } = useSignedIn();
	const options = orpc.career.savedItems.queryOptions({ input: { applicationId } });
	return useQuery({ ...options, queryKey: [...options.queryKey, server], enabled });
}

export function useFacts(applicationId: string) {
	const { server, enabled } = useSignedIn();
	const options = orpc.career.facts.queryOptions({ input: { applicationId } });
	return useQuery({ ...options, queryKey: [...options.queryKey, server], enabled });
}

export function useStories(applicationId: string) {
	const { server, enabled } = useSignedIn();
	const options = orpc.career.stories.queryOptions({ input: { applicationId } });
	return useQuery({ ...options, queryKey: [...options.queryKey, server], enabled });
}

/** Home's schedules query: one cache copy, so a switch flipped on Home shows here and the other way round. */
export { useSchedules } from "@/features/home/queries";

/** The newest saved item of one kind, optionally for one interview. */
export function latest<K extends SavedItem["data"]["kind"]>(
	items: SavedItem[] | undefined,
	kind: K,
	interviewId?: string | null,
) {
	return items?.find(
		(item): item is SavedItem & { data: SavedData<K> } =>
			item.data.kind === kind && (interviewId === undefined || item.interviewId === interviewId),
	);
}

/**
 * Asks the coach for one structured piece of work for a part. The consent before it runs names where it goes (and
 * the cost on Android); errors say what didn't run, and stored data stays usable.
 */
export function useGenerate(applicationId: string) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const connection = useHasAIProvider();
	const name = connection.defaultProvider?.label ?? t`Your AI connection`;
	const mutation = useMutation({
		...orpc.career.generate.mutationOptions(),
		onSuccess: (result) => {
			haptics.success();
			if (result.item) void queryClient.invalidateQueries({ queryKey: orpc.career.savedItems.key() });
		},
		onError: (error) => {
			if (isQuietAiError(error)) return;
			haptics.error();
			// The consent step explains its own refusals ("Choose a tested AI provider…"); the server's are generic.
			const own = !(error instanceof ORPCError) && error instanceof Error && error.message ? error.message : null;
			showToast({
				title: own ?? workspaceError(error, t`${name} didn't respond. Nothing was changed; try again.`),
				variant: "danger",
			});
		},
	});
	return {
		...mutation,
		run: (task: GenerateTask) => {
			if (connection.isUnavailable)
				return Promise.reject(new Error(t`AI connections haven't loaded. Try again before generating.`));
			return mutation.mutateAsync({ applicationId, locale: i18n.locale, task });
		},
	};
}
