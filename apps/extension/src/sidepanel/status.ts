import { useLingui } from "@lingui/react/macro";

/** The tracker's stages with the words the web app uses (Rezumi's "Lamaran" screens). */
export function useStatusLabels() {
	const { t } = useLingui();
	return {
		saved: t({ message: "Saved", comment: "Application stage: saved, not applied yet" }),
		applied: t({ message: "Applied", comment: "Application stage" }),
		screening: t({ message: "Screening", comment: "Application stage" }),
		interview: t({ message: "Interview", comment: "Application stage" }),
		offer: t({ message: "Offer", comment: "Application stage" }),
		closed: t({ message: "Closed", comment: "Application stage: ended" }),
	} as const;
}
