import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import z from "zod";
import { workspaceTabSchema } from "@rezumi/schema/career";
import { useDialogStore } from "@/dialogs/store";
import { prepareDialogData } from "@/features/applications/extension-links";
import { Workspace } from "@/features/career/workspace/shell";

export const Route = createFileRoute("/dashboard/applications/$applicationId/{-$tab}")({
	// Sheets and dialogs are URL state, so back, forward, reload and notification links all open them.
	validateSearch: z.object({
		// true: the newest conversation about this job; "new": a fresh one; otherwise that conversation's id.
		coach: z
			.union([z.literal(true), z.string().min(1)])
			.optional()
			.catch(undefined),
		edit: z.literal("interview").optional().catch(undefined),
		version: z.string().min(1).optional().catch(undefined),
		// Practise opens with Speak selected ("Rehearse one answer aloud").
		speak: z.boolean().optional().catch(undefined),
		story: z.string().min(1).optional().catch(undefined),
		// The browser extension's "Tailor resume": open "Copy for a job" once (features/applications/extension-links.ts).
		prepare: z.literal("resume").optional().catch(undefined),
		from: z.string().min(1).optional().catch(undefined),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { applicationId, tab } = Route.useParams();
	const { prepare, from, ...search } = Route.useSearch();
	const navigate = Route.useNavigate();
	const openDialog = useDialogStore((state) => state.openDialog);
	const parsed = workspaceTabSchema.safeParse(tab);

	useEffect(() => {
		const data = prepareDialogData({ prepare, from }, applicationId);
		if (!data) return;
		openDialog("document.new", data);
		// Once: back, forward and reload don't open it again.
		void navigate({ search: { ...search, prepare: undefined, from: undefined }, replace: true });
	}, [prepare, from, applicationId, openDialog, navigate, search]);

	return <Workspace applicationId={applicationId} tab={parsed.success ? parsed.data : undefined} search={search} />;
}
