// One run of "fill the Profile from what I have" on a phone: what was entered, each source's run (createSourceRunner
// from @rezumi/resume, as on the web), and the review of what they found. Plan and credit refusals explain themselves
// in the API client, so nothing here shows them again.
import type { PickedFile } from "./read-file";
import type { SavedOnboarding } from "./saved-run";
import type {
	PhotoCandidate,
	SourceAvailability,
	SourceId,
	SourceInputProblem,
	SourceInputs,
	SourceRequest,
	SourceRuns,
} from "@rezumi/resume/profile-sources";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { useEffect, useState } from "react";
import {
	applyReview,
	clearEditedProblems,
	createSourceRunner,
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
import { readResumeFile } from "./read-file";
import { client } from "@/api/client";

type SourcesFlowOptions = {
	base: ProfileData;
	availability: SourceAvailability;
	/** The account's own photo (from signing in), offered while the Profile has none. */
	accountImage: string | null;
	/** Prefilled GitHub username (the account's GitHub sign-in). */
	github: string;
	/** Whether a PDF or Word file can go to the account's AI (else a PDF's text layer is read by the server). */
	aiAvailable: boolean;
	/** An onboarding picked up again. */
	restore: SavedOnboarding | null;
};

function fetchSource(request: SourceRequest<PickedFile>, aiAvailable: boolean): Promise<SourceResult> {
	switch (request.id) {
		case "file":
			return readResumeFile(request.file, aiAvailable);
		case "linkedin":
			return client.profile.sources.linkedin({ url: request.url });
		case "github":
			return client.profile.sources.github({ username: request.username });
		case "website":
			return client.profile.sources.website({ url: request.url });
	}
}

export function useSourcesFlow({ base, availability, accountImage, github, aiAvailable, restore }: SourcesFlowOptions) {
	const [inputs, setInputs] = useState<SourceInputs<PickedFile>>(() =>
		restore ? { ...restore.inputs, file: null } : emptySourceInputs<PickedFile>(github),
	);
	const [problems, setProblems] = useState<Partial<Record<SourceId, SourceInputProblem>>>({});
	const [excluded, setExcluded] = useState<Set<string>>(() => new Set(restore?.excluded ?? []));
	const [photoChoice, setPhotoChoice] = useState<string | null | undefined>(restore?.photo);
	const [runs, setRuns] = useState<SourceRuns>(() => restore?.runs ?? {});
	// A file read before the app closed: the file itself is gone, its result stays until another file replaces it.
	const [restoredFile, setRestoredFile] = useState(() => restore?.runs.file?.status === "done");
	const [runner] = useState(() =>
		createSourceRunner<PickedFile>({
			onChange: setRuns,
			initial: restore?.runs ?? {},
		}),
	);

	// This render's reader: a connection set up meanwhile counts for the next run or retry.
	const read = (request: SourceRequest<PickedFile>) => fetchSource(request, aiAvailable);

	// The restored file's result is asked for again under its own key, so the runner keeps it as found.
	const restoredFileRequest = (): SourceRequest<PickedFile>[] =>
		restoredFile && !inputs.file && runs.file ? [{ id: "file", key: runs.file.key, file: { name: "", uri: "" } }] : [];

	// A run picked up again: sources still being read when the app closed are read again from what was entered
	// (alongside the finished ones, which the runner keeps). A file can't be: it's chosen again on the first step.
	useEffect(() => {
		if (!restore?.rerun.length) return;
		const { requests } = readSourceInputs(inputs, availability);
		const again = requests.filter((request) => request.id !== "file" && restore.rerun.includes(request.id));
		if (again.length === 0) return;
		const kept = requests.filter((request) => restore.runs[request.id]?.status === "done");
		runner.run([...restoredFileRequest(), ...kept, ...again], read);
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- once, for the run as it was restored
	}, []);

	const merged = mergeSourceResults(base, runs);
	const groups = reviewGroups(base, merged);
	const photos = photoCandidates(base, runs, accountImage);
	const photo = keptPhoto(photos, photoChoice);

	return {
		inputs,
		problems,
		runs,
		fetching: isFetching(runs),
		merged,
		groups,
		excluded,
		photos,
		photo,
		/** What the person picked for the photo (undefined until they pick), to save with the run. */
		photoChoice,
		/** A file read before the app closed, kept while no other file is chosen. */
		restoredFile: restoredFile && !inputs.file,
		removeRestoredFile: () => setRestoredFile(false),
		// A file restored from before counts as entered: its result is there to review.
		hasInput: hasSourceInput(inputs, availability) || (restoredFile && !inputs.file),
		change: (patch: Partial<SourceInputs<PickedFile>>) => {
			setInputs((current) => ({ ...current, ...patch }));
			setProblems((current) => clearEditedProblems(current, patch));
		},
		/** Starts the sources entered; returns the problems that stop it, or null when it started. */
		start: () => {
			const { requests, problems: found } = readSourceInputs(inputs, availability);
			setProblems(found);
			if (Object.keys(found).length > 0) return found;
			runner.run([...restoredFileRequest(), ...requests], read);
			return null;
		},
		/** Goes on with no source: nothing runs or gets merged. */
		skip: () => {
			setProblems({});
			runner.run([], read);
		},
		retry: (id: SourceId) => runner.retry(id, read),
		setExcluded,
		setPhoto: setPhotoChoice,
		/**
		 * The reviewed Profile with the kept photo copied into the account's uploads. `onto` is the Profile to add to
		 * when it changed since the review was built (saved elsewhere meanwhile): what was found and kept goes onto it, so
		 * nothing saved in between is lost, and a photo set in between stays.
		 */
		finish: (copied: Map<string, string>, onto: ProfileData = base) =>
			withKeptPhoto(
				applyReview(onto, onto === base ? merged : mergeSourceResults(onto, runs), excluded),
				onto.picture.url === base.picture.url
					? (photos.find((candidate: PhotoCandidate) => candidate.url === photo) ?? null)
					: null,
				copied,
				async (url) => (await client.profile.sources.adoptPhoto({ url })).url,
			),
	};
}
