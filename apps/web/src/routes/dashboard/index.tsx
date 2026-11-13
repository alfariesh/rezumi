import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";
import { useOverlayHistory } from "@/features/career/hooks";
import { HomePage } from "@/features/career/today";
import { shouldStartOnboarding } from "@/features/onboarding/redirect";

/** Documents' filters, which this address carried before Home took it. */
const legacyDocumentsSearch = z.object({
	type: z.enum(["all", "resume", "letter"]).optional().catch(undefined),
	q: z.string().optional().catch(undefined),
	tags: z.array(z.string()).optional().catch(undefined),
	public: z.boolean().optional().catch(undefined),
	sort: z.enum(["edited", "name", "created"]).optional().catch(undefined),
	view: z.enum(["grid", "list"]).optional().catch(undefined),
	letter: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/dashboard/")({
	validateSearch: legacyDocumentsSearch.extend({
		// `schedule`: a schedule's id or "new" opens the schedule sheet, so links from notifications can open it.
		schedule: z.string().min(1).optional().catch(undefined),
	}),
	// Documents lived here until Home did: a filtered link (or an older letter link) still reaches it.
	beforeLoad: ({ search }) => {
		const { type, q, tags, public: publicOnly, sort, view, letter } = search;
		if (letter)
			throw redirect({ to: "/builder/letter/$coverLetterId", params: { coverLetterId: letter }, replace: true });
		if ([type, q, tags, publicOnly, sort, view].every((value) => value === undefined)) return;
		throw redirect({
			to: "/dashboard/documents",
			search: {
				...(type ? { type } : {}),
				...(q ? { q } : {}),
				...(tags ? { tags } : {}),
				...(publicOnly ? { public: publicOnly } : {}),
				...(sort ? { sort } : {}),
				...(view ? { view } : {}),
			},
			replace: true,
		});
	},
	// A new account starts with onboarding; Skip or finishing it saves the Profile, so it opens once.
	loader: async ({ context }) => {
		if (await shouldStartOnboarding(context.queryClient, context.session))
			throw redirect({ to: "/onboarding", replace: true });
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { schedule } = Route.useSearch();
	const navigate = Route.useNavigate();
	const overlay = useOverlayHistory();
	const onScheduleChange = (next: string | undefined) => {
		if (!next) return overlay.close(() => void navigate({ search: {}, replace: true }));
		if (!schedule) overlay.open();
		void navigate({ search: { schedule: next }, replace: Boolean(schedule) });
	};
	return <HomePage schedule={schedule} onScheduleChange={onScheduleChange} />;
}
