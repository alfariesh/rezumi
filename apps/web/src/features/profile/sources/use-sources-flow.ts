import type { PhotoCandidate, SourceAvailability, SourceId, SourceInputProblem, SourceInputs } from "./model";
import type { ProfileData } from "@rezumi/schema/profile/data";
import { useState } from "react";
import {
	applyReview,
	emptySourceInputs,
	hasSourceInput,
	isFetching,
	mergeSourceResults,
	photoCandidates,
	readSourceInputs,
	reviewGroups,
} from "./model";
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
	const [inputs, setInputs] = useState<SourceInputs>(() => emptySourceInputs(github));
	const [problems, setProblems] = useState<Partial<Record<SourceId, SourceInputProblem>>>({});
	const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
	// Undefined until the person picks: then the first photo offered is the one kept.
	const [photoChoice, setPhotoChoice] = useState<string | null | undefined>(undefined);
	const sources = useSourceRuns();

	const merged = mergeSourceResults(base, sources.runs);
	const groups = reviewGroups(base, merged);
	const photos = photoCandidates(base, sources.runs, accountImage);
	const photo =
		photoChoice === undefined || (photoChoice !== null && !photos.some((candidate) => candidate.url === photoChoice))
			? (photos[0]?.url ?? null)
			: photoChoice;

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
		change: (patch: Partial<SourceInputs>) => {
			setInputs((current) => ({ ...current, ...patch }));
			// A field's problem goes as soon as it's edited; the rest wait for the next try.
			setProblems((current) => {
				const next = { ...current };
				if ("linkedin" in patch || "linkedinOwn" in patch) delete next.linkedin;
				if ("github" in patch) delete next.github;
				if ("website" in patch) delete next.website;
				return next;
			});
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

export type SourcesFlow = ReturnType<typeof useSourcesFlow>;

/**
 * The address to save for a kept photo: a file's own picture as it is, anything else copied into the account's
 * uploads first, so the Profile never points at someone else's server.
 */
export async function keepPhoto(candidate: PhotoCandidate): Promise<string> {
	if (candidate.source === "file") return candidate.url;
	const { url } = await client.profile.sources.adoptPhoto({ url: candidate.url });
	return url;
}

/**
 * The reviewed Profile with the kept photo copied in. `copied` remembers copies, so saving again doesn't copy twice.
 * A photo that can't be copied is left out (`photoFailed`), and the rest still goes in.
 */
export async function finishReview(flow: SourcesFlow, copied: Map<string, string>) {
	const data = flow.reviewed();
	const candidate = flow.photoCandidate();
	if (!candidate) return { data, photoFailed: false };
	try {
		const url = copied.get(candidate.url) ?? (await keepPhoto(candidate));
		copied.set(candidate.url, url);
		data.picture.url = url;
		return { data, photoFailed: false };
	} catch {
		return { data, photoFailed: true };
	}
}
