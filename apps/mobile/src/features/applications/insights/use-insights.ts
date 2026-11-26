// Insights' figures (the web's insights-view.tsx) from the one applications list, closed ones included, so they match
// the server's stats without another query. Weeks count on the profile's clock (Settings → Preferences, else the
// device's) from the locale's first weekday. A resume counts as tailored when it was made for that application (New →
// Copy for a job), which the documents list tells.
import type { ApplicationSummary } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { weekStartsOn } from "@rezumi/career/calendar";
import { computeOutcomes, computePipeline, computeTimeline, countSources } from "@rezumi/career/insights";
import { deviceTimeZone, isTimeZone } from "@rezumi/career/time";
import { useOnline } from "@/api/online";
import { useProfile } from "@/features/account/queries";
import { useApplications } from "@/features/applications/queries";
import { useNow } from "@/features/career/hooks";
import { useDocuments } from "@/features/documents/queries";

type Clock = { now: Date; timeZone: string; weekStartsOn: number };

/** Every figure the screen draws; `madeFor` maps a resume id to the application it was made for. */
export function figuresOf(
	applications: readonly ApplicationSummary[],
	madeFor: ReadonlyMap<string, string>,
	clock: Clock,
) {
	return {
		outcomes: computeOutcomes(applications, (application) =>
			Boolean(application.resumeId && madeFor.get(application.resumeId) === application.id),
		),
		timeline: computeTimeline(applications, clock),
		sources: countSources(applications),
		pipeline: computePipeline(applications),
	};
}

export type InsightsFigures = ReturnType<typeof figuresOf>;

export function useInsights() {
	const { i18n } = useLingui();
	const applications = useApplications();
	const documents = useDocuments();
	const profile = useProfile();
	const now = useNow();
	const online = useOnline();
	const preferred = profile.data?.timezone;
	const timeZone = preferred && isTimeZone(preferred) ? preferred : deviceTimeZone();
	const madeFor = new Map(
		(documents.data ?? []).flatMap((document) =>
			document.application ? [[document.id, document.application.id] as const] : [],
		),
	);
	const figures = applications.data
		? figuresOf(applications.data, madeFor, { now, timeZone, weekStartsOn: weekStartsOn(i18n.locale) })
		: null;
	return {
		applications,
		figures,
		/** Tailored against base is only told once the documents list is in. */
		knowsTailored: documents.data !== undefined,
		online,
		locale: i18n.locale,
		refetch: () => Promise.allSettled([applications.refetch(), documents.refetch()]),
	};
}
