import type { ProfileDto } from "./queries";
import type { PageSettings } from "@/features/resume/editor/write/entries";
import { Button, Skeleton, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { isSectionInUse } from "@rezumi/resume/write";
import { PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { Icon } from "@rezumi/ui/components/icon";
import { stripHtml } from "@rezumi/utils/string";
import { FillProfile } from "./fill";
import { profileQueryOptions } from "./queries";
import {
	bindProfileQueryClient,
	hasUnsavedProfileChanges,
	profileWriteSource,
	saveProfileNow,
	useProfileDraftStore,
} from "./store";
import { SortableProvider } from "@/components/input/sortable";
import { CareerLoadError } from "@/features/career/load-state";
import { useEditorStore } from "@/features/resume/editor/store";
import { AddSectionMenu, StartSuggestions } from "@/features/resume/editor/write/add-section";
import { BasicsCard } from "@/features/resume/editor/write/basics-card";
import { OutlineSection } from "@/features/resume/editor/write/outline";
import { useWriteSelector, WriteSourceProvider } from "@/features/resume/editor/write/source";

const sameVersion = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Shows the Profile read from the server, unless what's on screen is newer or the same version. */
function useLoadProfile(profile: ProfileDto | undefined) {
	useEffect(() => {
		if (!profile) return;
		const state = useProfileDraftStore.getState();
		if (state.data && (hasUnsavedProfileChanges() || sameVersion(state.updatedAt, profile.updatedAt))) return;
		state.load(profile);
	}, [profile]);
}

/** Which Profile page: Details (name, photo, contact, links) or Career (the summary and every built-in section). */
type ProfilePart = "details" | "career";

type ProfileDetailsPageProps = { part: ProfilePart };

/**
 * Profile → Details or Career, edited with the resume editor's own forms and saved as you type. Resumes still using a
 * part follow when it changes here.
 */
export function ProfileDetailsPage({ part }: ProfileDetailsPageProps) {
	const queryClient = useQueryClient();
	const query = useQuery(profileQueryOptions());
	const ready = useProfileDraftStore((state) => state.data !== null);
	useLoadProfile(query.data);

	useEffect(() => {
		bindProfileQueryClient(queryClient);
		// The forms keep their open sections and selection in the resume editor's store; start clean and leave it so.
		useEditorStore.getState().reset();
		useProfileDraftStore.setState({ followed: [] });
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!hasUnsavedProfileChanges()) return;
			void saveProfileNow();
			event.preventDefault();
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", onBeforeUnload);
			void saveProfileNow();
			useEditorStore.getState().reset();
		};
	}, [queryClient]);

	if (query.isError && !ready) return <CareerLoadError onRetry={() => void query.refetch()} />;
	if (!ready)
		return (
			<div className="grid max-w-[720px] gap-4">
				<Skeleton className="h-40 rounded-2xl" />
				<Skeleton className="h-64 rounded-2xl" />
			</div>
		);

	return (
		<WriteSourceProvider source={profileWriteSource}>
			{part === "details" ? <ProfileDetails /> : <ProfileCareer />}
		</WriteSourceProvider>
	);
}

/** Details: name, headline, photo, contact details and links. */
function ProfileDetails() {
	return (
		<div className="grid max-w-[720px] gap-8">
			<BasicsCard locked={false} />
		</div>
	);
}

/** Career: the summary and the career sections; while it's empty, a way to fill it from a file or a resume. */
function ProfileCareer() {
	const { i18n } = useLingui();
	const page: PageSettings = { locale: i18n.locale };
	const careerEmpty = useWriteSelector(
		(data) =>
			!stripHtml(data.summary.content).trim() &&
			PROFILE_SECTION_TYPES.every((type) => data.sections[type].items.length === 0),
	);

	return (
		<div className="grid max-w-[720px] gap-8">
			{careerEmpty && <FillProfile />}
			<CareerSections page={page} />
			<AddSectionMenu />
		</div>
	);
}

type CareerSectionsProps = { page: PageSettings };

/** The summary and the career sections in use, in the Profile's fixed order. Empty ones wait in Add section. */
function CareerSections({ page }: CareerSectionsProps) {
	const added = useEditorStore((state) => state.addedSections);
	const key = useWriteSelector((data) =>
		(["summary", ...PROFILE_SECTION_TYPES] as const)
			.filter((type) => isSectionInUse(data, type, new Set(added)))
			.join(","),
	);
	const ids = key ? key.split(",") : [];

	if (ids.length === 0) return <StartSuggestions />;

	// The page's header already says Career: the sections follow it with no heading of their own.
	return (
		<div className="@container grid min-w-0 gap-0.5">
			{/* Sections keep the Profile's order; the provider only serves the entries' own reordering. */}
			<SortableProvider onMove={() => {}}>
				{ids.map((id, index) => (
					<OutlineSection key={id} sectionId={id} index={index} locked={false} page={page} />
				))}
			</SortableProvider>
		</div>
	);
}

/**
 * Where saving is, as one cloud icon beside the page's title; its tooltip says that changes save as you type and which
 * resumes followed this visit's changes. A failed save shows its reason and Retry instead.
 */
export function ProfileSaveStatus() {
	const status = useProfileDraftStore((state) => state.status);
	const followed = useProfileDraftStore((state) => state.followed);
	const retry = useProfileDraftStore((state) => state.retry);

	if (status === "error")
		return (
			<p role="status" className="flex items-center gap-1 text-sm text-danger">
				<Icon name="cloud-warning" size={20} />
				<Trans>Not saved.</Trans>
				<Button size="sm" variant="ghost" onPress={retry}>
					<Trans>Retry</Trans>
				</Button>
			</p>
		);

	const label = status === "saving" ? t`Saving…` : status === "saved" ? t`Saved` : t`Saves as you type`;
	return (
		<>
			<Tooltip>
				<Tooltip.Trigger aria-label={label} className="flex text-muted">
					<Icon
						name={status === "saving" ? "circle-notch" : "cloud-check"}
						size={20}
						className={status === "saving" ? "animate-spin" : undefined}
					/>
				</Tooltip.Trigger>
				<Tooltip.Content className="grid max-w-64 gap-1">
					<span>{label}</span>
					<span className="text-muted">
						{followed.length > 0 ? (
							<>
								<Plural value={followed.length} one="Updated in # resume" other="Updated in # resumes" />:{" "}
								{followed.map((resume) => resume.name).join(", ")}
							</>
						) : (
							<Trans>Resumes that still use a part follow your changes.</Trans>
						)}
					</span>
				</Tooltip.Content>
			</Tooltip>
			{/* Outside the tooltip, so screen readers hear saving and saved while it's closed. */}
			<span role="status" className="sr-only">
				{status === "idle" ? "" : label}
			</span>
		</>
	);
}
