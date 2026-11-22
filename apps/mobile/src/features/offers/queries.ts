// Offers' reads (the web's offers.tsx): the saved offers, newest first, and the career profile whose Preferences the
// offers are checked against. Same keys as the rest of the app, so a save in an application's Messages shows here.
import type { RouterOutput } from "@/api/client";
import type { OfferTerms } from "@rezumi/schema/career";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";

type SavedItem = RouterOutput["career"]["savedItems"][number];
export type Offer = SavedItem & { data: OfferTerms & { kind: "offer" } };

const isOffer = (item: SavedItem): item is Offer => item.data.kind === "offer";

export function useSavedOffers() {
	const session = useSession();
	const query = useQuery({
		...orpc.career.savedItems.queryOptions({ input: { kind: "offer" } }),
		enabled: session.status === "signed-in",
		retry: false,
		queryKey: [...orpc.career.savedItems.key(), session.server, "offer"],
	});
	return { ...query, offers: query.data?.filter(isOffer) };
}

export function useCareerProfile() {
	const session = useSession();
	return useQuery({
		...orpc.career.profile.queryOptions(),
		enabled: session.status === "signed-in",
		retry: false,
		queryKey: [...orpc.career.profile.key(), session.server],
	});
}
