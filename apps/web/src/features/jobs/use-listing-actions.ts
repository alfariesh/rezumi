import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { t } from "@lingui/core/macro";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { useDialogStore } from "@/dialogs/store";
import { useInvalidateApplications } from "@/features/applications/use-application-actions";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/**
 * What a listing's buttons do: Track saves it as an application (the same one again if it's already saved), Tailor
 * resume tracks it first and then opens the copy-and-tailor flow, Hide takes it out of the person's results (with
 * undo). Tracked and hidden listings are remembered here for the page's life; the server marks them on the next search.
 */
export function useListingActions(tracked: Record<string, string>) {
	const [trackedHere, setTrackedHere] = useState<Record<string, string>>({});
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
	const invalidateApplications = useInvalidateApplications();
	const openDialog = useDialogStore((state) => state.openDialog);
	const trackMutation = useMutation(orpc.jobs.track.mutationOptions());
	const saveLogo = useMutation(orpc.applications.saveLogo.mutationOptions());
	const hideMutation = useMutation(orpc.jobs.hide.mutationOptions());
	// Listings being tracked now; several can be at once.
	const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
	const setTracking = (listingId: string, busy: boolean) =>
		setPending((current) => {
			const next = new Set(current);
			if (busy) next.add(listingId);
			else next.delete(listingId);
			return next;
		});

	const applicationFor = (listingId: string) => trackedHere[listingId] ?? tracked[listingId];

	const track = async (listing: JobListingCard): Promise<string | null> => {
		const existing = applicationFor(listing.id);
		if (existing) return existing;
		setTracking(listing.id, true);
		try {
			const result = await trackMutation.mutateAsync({ id: listing.id });
			setTrackedHere((current) => ({ ...current, [listing.id]: result.applicationId }));
			invalidateApplications();
			// The logo is copied into the account's uploads, as the extension does; a logo that can't be copied leaves
			// the company's initial.
			if (result.created && listing.company.logoUrl?.startsWith("https://"))
				saveLogo.mutate(
					{ id: result.applicationId, logoUrl: listing.company.logoUrl },
					{ onSuccess: () => invalidateApplications() },
				);
			return result.applicationId;
		} catch (error) {
			toastError(error, t`This job couldn't be tracked. Try again.`);
			return null;
		} finally {
			setTracking(listing.id, false);
		}
	};

	const trackWithToast = async (listing: JobListingCard) => {
		const already = Boolean(applicationFor(listing.id));
		const applicationId = await track(listing);
		if (applicationId && !already) toast.add({ description: t`Tracking ${listing.title} at ${listing.company.name}` });
	};

	const tailor = async (listing: JobListingCard) => {
		const applicationId = await track(listing);
		if (applicationId) openDialog("document.new", { step: "copy", applicationId });
	};

	const setListingHidden = async (listing: JobListingCard, hide: boolean) => {
		setHidden((current) => {
			const next = new Set(current);
			if (hide) next.add(listing.id);
			else next.delete(listing.id);
			return next;
		});
		try {
			await hideMutation.mutateAsync({ id: listing.id, hidden: hide });
			if (hide)
				toast.add({
					description: t`Hidden ${listing.title}. It won't show in your results again.`,
					actionProps: { children: t`Undo`, onPress: () => void setListingHidden(listing, false) },
				});
		} catch (error) {
			setHidden((current) => {
				const next = new Set(current);
				if (hide) next.delete(listing.id);
				else next.add(listing.id);
				return next;
			});
			toastError(error, t`That didn't save. Try again.`);
		}
	};

	return {
		applicationFor,
		isPending: (listingId: string) => pending.has(listingId),
		isHidden: (listingId: string) => hidden.has(listingId),
		track: trackWithToast,
		tailor,
		hide: (listing: JobListingCard) => void setListingHidden(listing, true),
	};
}
