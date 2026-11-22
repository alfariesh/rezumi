import type {
	PhotoCandidate,
	SourceAvailability,
	SourceId,
	SourceInputProblem,
	SourceInputs,
} from "@rezumi/resume/profile-sources";
import type { ProfileData } from "@rezumi/schema/profile/data";
import { useState } from "react";
import {
	applyReview,
	clearEditedProblems,
	emptySourceInputs,
	hasSourceInput,
	isFetching,
	keptPhoto,
	mergeSourceResults,
	photoCandidates,
	readSourceInputs,
	reviewGroups,
	withKeptPhoto,
} from "@rezumi/resume/profile-sources";
import { useSourceRuns } from "./use-source-runs";
import { client } from "@/libs/orpc/client";

type SourcesFlowOptions = {
	/** The Profile the sources add to. */
	base: ProfileData;
	availability: SourceAvailability;
	/** The account's own photo (from signing in), offered while the Profile has none. */
	accountImage: string | null;
	/** Prefilled GitHub username (the account's GitHub sign-in). */
	github?: string | undefined;
};

/**
 * One run of "fill the Profile from what I have": what was entered, each source's run, and the review of what they
 * found (everything ticked, the first photo offered). Onboarding and the Profile's empty state both drive it.
 */
export function useSourcesFlow({ base, availability, accountImage, github = "" }: SourcesFlowOptions) {
	const [inputs, setInputs] = useState<SourceInputs<File>>(() => emptySourceInputs<File>(github));
	const [problems, setProblems] = useState<Partial<Record<SourceId, SourceInputProblem>>>({});
	const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
	// Undefined until the person picks: then the first photo offered is the one kept.
	const [photoChoice, setPhotoChoice] = useState<string | null | undefined>(undefined);
	const sources = useSourceRuns();

	const merged = mergeSourceResults(base, sources.runs);
	const groups = reviewGroups(base, merged);
	const photos = photoCandidates(base, sources.runs, accountImage);
	const photo = keptPhoto(photos, photoChoice);

	return {
		inputs,
		problems,
		runs: sources.runs,
		fetching: isFetching(sources.runs),
		merged,
		groups,
		excluded,
		photos,
		photo,
		hasInput: hasSourceInput(inputs, availability),
		change: (patch: Partial<SourceInputs<File>>) => {
			setInputs((current) => ({ ...current, ...patch }));
			setProblems((current) => clearEditedProblems(current, patch));
		},
		/**
		 * Starts the sources entered (those already found stay as they are). Returns the problems that stop it, or null
		 * when it started; with nothing entered nothing runs.
		 */
		start: () => {
			const { requests, problems: found } = readSourceInputs(inputs, availability);
			setProblems(found);
			if (Object.keys(found).length > 0) return found;
			sources.run(requests);
			return null;
		},
		/** Goes on with no source: what was typed stays in the fields, but nothing runs or gets merged. */
		skip: () => {
			setProblems({});
			sources.run([]);
		},
		retry: sources.retry,
		setExcluded,
		setPhoto: setPhotoChoice,
		/** The Profile to save, without the photo (see `keepPhoto`). */
		reviewed: () => applyReview(base, merged, excluded),
		photoCandidate: (): PhotoCandidate | null => photos.find((candidate) => candidate.url === photo) ?? null,
	};
}

type SourcesFlow = ReturnType<typeof useSourcesFlow>;

/** The reviewed Profile with the kept photo copied into the account's uploads (`withKeptPhoto`). */
export const finishReview = (flow: SourcesFlow, copied: Map<string, string>) =>
	withKeptPhoto(flow.reviewed(), flow.photoCandidate(), copied, async (url) => {
		const { url: kept } = await client.profile.sources.adoptPhoto({ url });
		return kept;
	});
