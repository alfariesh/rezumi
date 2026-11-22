// What a listing's buttons do (the web's use-listing-actions.ts): Track saves it as an application (the same one again
// if it's already saved), Tailor resume tracks it first and then opens New → Copy a resume for that job, Hide takes it
// out of the person's results with Undo. Tracked and hidden listings are remembered here for the screen's life; the
// server marks them on the next search.
import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { client } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useInvalidateApplications } from "@/features/applications/queries";
import { withUndo } from "@/features/career/undo";
import { routes } from "@/routes";
import { haptics, showToast } from "@/ui";

const without = (set: ReadonlySet<string>, id: string) => {
	const next = new Set(set);
	next.delete(id);
	return next;
};

type ListingActionsOptions = {
	/**
	 * Opens New → Copy a resume for the job. The screen closes the listing's sheet first when one is open: iOS can't
	 * present New (a form sheet) over a native sheet.
	 */
	onTailor: (applicationId: string) => void;
};

export function useListingActions(tracked: Record<string, string>, { onTailor }: ListingActionsOptions) {
	const { t } = useLingui();
	const router = useRouter();
	const { server } = useSession();
	const invalidateApplications = useInvalidateApplications();
	const [trackedHere, setTrackedHere] = useState<Record<string, string>>({});
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
	// Listings being tracked now; several can be at once.
	const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
	const saveLogo = useMutation({
		mutationFn: (input: { id: string; logoUrl: string }) => client.applications.saveLogo(input),
		onSuccess: () => void invalidateApplications(),
	});

	const applicationFor = (listingId: string): string | undefined => trackedHere[listingId] ?? tracked[listingId];

	const track = async (listing: JobListingCard): Promise<string | null> => {
		const existing = applicationFor(listing.id);
		if (existing) return existing;
		setPending((current) => new Set(current).add(listing.id));
		try {
			const result = await client.jobs.track({ id: listing.id });
			if (getServer() !== server) return null;
			setTrackedHere((current) => ({ ...current, [listing.id]: result.applicationId }));
			void invalidateApplications();
			// The logo is copied into the account's uploads, as the web and the extension do; a logo that can't be
			// copied leaves the company's initial.
			if (result.created && listing.company.logoUrl?.startsWith("https://"))
				saveLogo.mutate({ id: result.applicationId, logoUrl: listing.company.logoUrl });
			return result.applicationId;
		} catch {
			haptics.error();
			showToast({ title: t`This job couldn't be tracked. Try again.`, variant: "danger" });
			return null;
		} finally {
			setPending((current) => without(current, listing.id));
		}
	};

	const trackWithToast = async (listing: JobListingCard) => {
		const already = Boolean(applicationFor(listing.id));
		const applicationId = await track(listing);
		if (applicationId && !already)
			showToast({ title: t`Tracking ${listing.title} at ${listing.company.name}`, variant: "success" });
	};

	const tailor = async (listing: JobListingCard) => {
		const applicationId = await track(listing);
		if (applicationId) onTailor(applicationId);
	};

	const hide = (listing: JobListingCard) => {
		setHidden((current) => new Set(current).add(listing.id));
		withUndo({
			message: t`Hidden ${listing.title}. It won't show in your results again.`,
			restore: () => setHidden((current) => without(current, listing.id)),
			failed: () => showToast({ title: t`That didn't save. Try again.`, variant: "danger" }),
			commit: async () => {
				if (getServer() !== server) return;
				await client.jobs.hide({ id: listing.id, hidden: true });
			},
		});
	};

	return {
		applicationFor,
		isPending: (listingId: string) => pending.has(listingId),
		isHidden: (listingId: string) => hidden.has(listingId),
		track: trackWithToast,
		tailor,
		hide,
		openApplication: (applicationId: string) => router.push(routes.application(applicationId)),
	};
}

export type ListingActions = ReturnType<typeof useListingActions>;
