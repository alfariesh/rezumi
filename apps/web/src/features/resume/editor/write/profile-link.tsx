import type { WriteSection } from "./model";
import type { WriteSource } from "./source";
import type { ProfileComparison } from "@rezumi/resume/profile";
import type { ProfileData, ProfilePart, ProfileSectionType } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import type { ReactNode } from "react";
import { Button, Dropdown, Label, Popover, Tooltip } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { createContext, use } from "react";
import { compareWithProfile, isBlank, takeFromProfile } from "@rezumi/resume/profile";
import { PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { stripHtml } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { openEntry } from "./actions";
import { describeEntry } from "./model";
import { readWriteData, useWriteSelector, useWriteSource } from "./source";
import { profileQueryOptions, storeSavedProfile } from "@/features/profile/queries";
import { savePendingChanges, useIsResumeLocked } from "@/features/resume/builder/draft";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/**
 * The builder's view of the account's Profile (`@rezumi/resume/profile`): which parts of the open resume read like
 * the Profile's ("linked", nothing to show), which are this resume's own version ("override", a calm marker with
 * Use Profile's and Save to Profile), and which Profile entries the resume leaves out (Add from Profile).
 *
 * A resume that shares nothing with the Profile (a sample, or one imported before the Profile was filled) is left
 * alone: its parts would all read as overrides, which says nothing useful.
 */

const ProfileContext = createContext<ProfileData | null>(null);

type ResumeProfileProviderProps = { children: ReactNode };

/** Reads the Profile once for every marker in the Write panel. */
export function ResumeProfileProvider({ children }: ResumeProfileProviderProps) {
	const { data } = useQuery(profileQueryOptions());
	return <ProfileContext value={data?.data ?? null}>{children}</ProfileContext>;
}

/** The Profile in the builder; null while it loads or on the Profile's own editor. */
export function useBuilderProfile(): ProfileData | null {
	return use(ProfileContext);
}

type ProfileView = { comparison: ProfileComparison; connected: boolean };

// One comparison per version of the resume and the Profile, shared by every marker: both are immutable, so a new
// version is a new object.
const views = new WeakMap<ResumeData, { profile: ProfileData; view: ProfileView }>();

function viewOf(data: ResumeData, profile: ProfileData): ProfileView {
	const cached = views.get(data);
	if (cached?.profile === profile) return cached.view;

	const comparison = compareWithProfile(data, profile);
	// Shares something with the Profile: a filled-in part that reads the same, or any entry taken from it.
	const connected =
		Object.entries(comparison.basics).some(
			([field, link]) => link === "linked" && !isBlank(profile.basics[field as keyof ProfileData["basics"]]),
		) ||
		(comparison.picture === "linked" && Boolean(profile.picture.url.trim())) ||
		(comparison.summary === "linked" && !isBlank(stripHtml(profile.summary.content))) ||
		PROFILE_SECTION_TYPES.some((section) => Object.values(comparison.items[section]).some((link) => link === "linked"));

	const view = { comparison, connected };
	views.set(data, { profile, view });
	return view;
}

/** A part's value in the resume or the Profile, for the blank checks and the preview. */
function partValue(source: ResumeData | ProfileData, part: ProfilePart): unknown {
	if (part.kind === "basics") return source.basics[part.field];
	if (part.kind === "picture") return source.picture.url;
	if (part.kind === "summary") return stripHtml(source.summary.content);
	const items = "metadata" in source ? source.sections[part.section].items : source.sections[part.section];
	return (items as { id: string }[]).find((item) => item.id === part.id);
}

/**
 * What a part shows. `both`: it differs from the Profile's, with Use Profile's and Save to Profile. `save`: the Profile
 * has nothing there yet, so only Save to Profile. `fill`: the resume leaves blank what the Profile has (never filled
 * for it, so a shared resume doesn't start showing a phone number by itself): no marker, only a quiet Use Profile's.
 */
type MarkerState = "both" | "save" | "fill";

/** What a part of `data` shows against `profile`; null shows nothing. Exported for tests. */
export function markerState(data: ResumeData, profile: ProfileData, part: ProfilePart): MarkerState | null {
	const { comparison, connected } = viewOf(data, profile);
	if (part.kind === "item") {
		// An entry the Profile has too always came from it (or from a copy), so a difference is worth showing.
		return comparison.items[part.section][part.id] === "override" ? "both" : null;
	}
	const link =
		part.kind === "basics"
			? comparison.basics[part.field]
			: part.kind === "picture"
				? comparison.picture
				: comparison.summary;
	if (link === "empty") return "fill";
	if (link !== "override" || !connected) return null;
	return isBlank(partValue(profile, part)) ? "save" : "both";
}

/** Writes the Profile's version of a part into the resume: an ordinary edit, undone like any other. */
function applyPart(draft: WritableDraft<ResumeData>, next: ResumeData, part: ProfilePart) {
	if (part.kind === "basics") (draft.basics as Record<string, unknown>)[part.field] = next.basics[part.field];
	else if (part.kind === "picture") draft.picture.url = next.picture.url;
	else if (part.kind === "summary") draft.summary.content = next.summary.content;
	else (draft.sections[part.section] as { items: unknown[] }).items = next.sections[part.section].items;
}

/**
 * Use Profile's: takes the Profile's version of parts, or adds Profile entries the resume doesn't have, in one undo
 * step. `prepare` runs first in the same step (placing a section that wasn't on the page).
 */
export function takeProfileParts(
	source: WriteSource,
	profile: ProfileData,
	parts: ProfilePart[],
	prepare?: (draft: WritableDraft<ResumeData>) => void,
) {
	const data = readWriteData(source);
	if (!data || parts.length === 0) return;
	const next = parts.reduce((current, part) => takeFromProfile(current, profile, part), data);
	source.update(
		(draft) => {
			prepare?.(draft);
			for (const part of parts) applyPart(draft, next, part);
		},
		{ newStep: true },
	);
}

/** Save to Profile: sends pending edits first, since the server reads the resume as saved. */
function useSaveToProfile() {
	const queryClient = useQueryClient();
	const { resumeId } = useParams({ strict: false }) as { resumeId?: string };
	const { mutateAsync, isPending } = useMutation(orpc.profile.savePart.mutationOptions());

	const save = async (part: ProfilePart) => {
		if (!resumeId) return;
		if (!(await savePendingChanges(resumeId))) {
			toast.add({ type: "error", description: t`Couldn't save this resume first, so nothing was sent. Try again.` });
			return;
		}
		try {
			const result = await mutateAsync({ resumeId, part });
			storeSavedProfile(queryClient, result);
			const others = result.updatedResumes.length;
			toast.add({
				description:
					others > 0
						? plural(others, {
								one: "Saved to your Profile. # other resume was updated too.",
								other: "Saved to your Profile. # other resumes were updated too.",
							})
						: t`Saved to your Profile.`,
			});
		} catch (error) {
			toastError(error, t`Couldn't save to your Profile. Try again.`);
		}
	};

	return { save, isPending };
}

type ProfileMarkerProps = { part: ProfilePart; className?: string };

/**
 * A small mark beside a part that differs from the Profile. It opens the Profile's version with Use Profile's and
 * Save to Profile. Only in the builder, on an editable resume.
 */
export function ProfileMarker({ part, className }: ProfileMarkerProps) {
	const source = useWriteSource();
	const profile = useBuilderProfile();
	const locked = useIsResumeLocked();
	const state = useWriteSelector((data) =>
		source.kind === "resume" && profile && !locked ? markerState(data, profile, part) : null,
	);
	if (!state || !profile) return null;
	if (state === "fill") return <FillFromProfile part={part} profile={profile} className={className} />;
	return <MarkerPopover part={part} state={state} profile={profile} className={className} />;
}

type FillFromProfileProps = { part: ProfilePart; profile: ProfileData; className?: string | undefined };

/** A blank part the Profile has filled in: a quiet Use Profile's, with the Profile's value in its tooltip. */
function FillFromProfile({ part, profile, className }: FillFromProfileProps) {
	const source = useWriteSource();
	return (
		<Tooltip>
			<Button
				size="sm"
				variant="ghost"
				className={cn("-my-1 h-6 px-1.5 text-xs text-muted hover:text-foreground", className)}
				onPress={() => takeProfileParts(source, profile, [part])}
			>
				<Trans>Use Profile's</Trans>
			</Button>
			<Tooltip.Content className="max-w-72">
				<ProfilePreview part={part} profile={profile} />
			</Tooltip.Content>
		</Tooltip>
	);
}

type MarkerPopoverProps = {
	part: ProfilePart;
	state: MarkerState;
	profile: ProfileData;
	className?: string | undefined;
};

function MarkerPopover({ part, state, profile, className }: MarkerPopoverProps) {
	const source = useWriteSource();
	const { save, isPending } = useSaveToProfile();
	const label = state === "save" ? t`Not in your Profile yet` : t`Differs from your Profile`;

	const take = () => {
		takeProfileParts(source, profile, [part]);
		toast.add({
			description: t`Using your Profile's version.`,
			actionProps: { children: t`Undo`, onClick: () => source.undo() },
		});
	};

	return (
		<Popover>
			<Tooltip>
				<Button
					isIconOnly
					size="sm"
					variant="ghost"
					aria-label={label}
					// The line keeps its height: the mark sits in the label's line without pushing the field down.
					className={cn("-my-1 size-6 min-w-6 text-muted hover:text-foreground", className)}
				>
					<Icon name="link-break" size={14} />
				</Button>
				<Tooltip.Content>{label}</Tooltip.Content>
			</Tooltip>
			<Popover.Content placement="bottom end" className="w-72">
				<Popover.Dialog className="grid gap-3 p-3">
					<p className="text-sm font-medium">{label}</p>
					{state === "both" && <ProfileVersion part={part} profile={profile} />}
					<p className="text-body-xs text-muted">
						{state === "save" ? (
							<Trans>Save it to your Profile to use it in new resumes, letters and your portfolio.</Trans>
						) : (
							<Trans>Changes made here stay in this resume.</Trans>
						)}
					</p>
					<div className="flex flex-wrap justify-end gap-2">
						<Button size="sm" variant="secondary" isPending={isPending} onPress={() => void save(part)}>
							<Trans>Save to Profile</Trans>
						</Button>
						{state === "both" && (
							<Button size="sm" onPress={take}>
								<Trans>Use Profile's</Trans>
							</Button>
						)}
					</div>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}

type ProfileVersionProps = { part: ProfilePart; profile: ProfileData };

/** The Profile's version of a part, as a short preview. */
function ProfilePreview({ part, profile }: ProfileVersionProps) {
	if (part.kind === "picture")
		return <img src={profile.picture.url} alt="" className="size-12 rounded-lg object-cover" />;
	let preview: string;
	if (part.kind === "item") {
		const item = partValue(profile, part) as Parameters<typeof describeEntry>[1] | undefined;
		const described = item ? describeEntry(part.section, item) : null;
		preview = described ? [described.title, described.meta].filter(Boolean).join(" · ") : "";
	} else if (part.kind === "basics" && part.field === "website") preview = profile.basics.website.url;
	else if (part.kind === "basics" && part.field === "customFields")
		preview = profile.basics.customFields.map((field) => field.text).join(" · ");
	else preview = String(partValue(profile, part) ?? "");
	return <span className="break-words">{preview.length > 160 ? `${preview.slice(0, 160)}…` : preview}</span>;
}

/** The preview under "In your Profile", in the marker's popover. */
function ProfileVersion({ part, profile }: ProfileVersionProps) {
	return (
		<div className="grid gap-1 rounded-lg bg-default p-2.5 text-sm">
			<span className="text-xs text-muted">
				<Trans>In your Profile</Trans>
			</span>
			<ProfilePreview part={part} profile={profile} />
		</div>
	);
}

type LocalEntryOptions = { section: WriteSection; entryId: string };

/** An entry the Profile doesn't have: "Save to Profile" in its ⋯ menu, without a marker. */
export function useLocalEntry({ section, entryId }: LocalEntryOptions) {
	const source = useWriteSource();
	const profile = useBuilderProfile();
	const local = useWriteSelector((data) => {
		if (source.kind !== "resume" || !profile || section.kind !== "builtin") return false;
		const type = section.id as ProfileSectionType;
		return viewOf(data, profile).comparison.items[type]?.[entryId] === "local";
	});
	const { save } = useSaveToProfile();
	return local ? () => void save({ kind: "item", section: section.id as ProfileSectionType, id: entryId }) : null;
}

type SaveToProfileMenuItemProps = { onAction: () => void };

/** The Dropdown item for `useLocalEntry`. */
export function SaveToProfileMenuItem({ onAction }: SaveToProfileMenuItemProps) {
	return (
		<Dropdown.Item id="save-to-profile" textValue={t`Save to Profile`} onAction={onAction}>
			<Icon name="upload-simple" className="text-muted" />
			<Label>
				<Trans>Save to Profile</Trans>
			</Label>
		</Dropdown.Item>
	);
}

type AddFromProfileProps = { section: WriteSection };

/** Add from Profile: the Profile entries this section doesn't have, one at a time or all at once. */
export function AddFromProfile({ section }: AddFromProfileProps) {
	const source = useWriteSource();
	const profile = useBuilderProfile();
	const type = section.id as ProfileSectionType;
	const key = useWriteSelector((data) =>
		source.kind === "resume" && profile && section.kind === "builtin"
			? (viewOf(data, profile).comparison.missing[type]?.join("\u0000") ?? "")
			: "",
	);
	if (!key || !profile) return null;
	const missing = key.split("\u0000");
	const items = profile.sections[type] as { id: string }[];

	const add = (ids: string[]) => {
		takeProfileParts(
			source,
			profile,
			ids.map((id) => ({ kind: "item", section: type, id })),
		);
		const [first] = ids;
		if (ids.length === 1 && first) openEntry(section.id, first);
	};

	return (
		<Dropdown>
			<Button variant="ghost" className="w-fit text-muted">
				<Icon name="user-circle" size={18} />
				<Trans>Add from Profile</Trans>
			</Button>
			<Dropdown.Popover placement="bottom start" className="w-72">
				<Dropdown.Menu>
					{missing.map((id) => {
						const item = items.find((candidate) => candidate.id === id);
						if (!item) return null;
						const { title, meta } = describeEntry(section.type, item as Parameters<typeof describeEntry>[1]);
						return (
							<Dropdown.Item key={id} id={id} textValue={title || t`Untitled`} onAction={() => add([id])}>
								<Label className="grid min-w-0">
									<span className="truncate">{title || t`Untitled`}</span>
									{meta && <span className="truncate text-xs text-muted">{meta}</span>}
								</Label>
							</Dropdown.Item>
						);
					})}
					{missing.length > 1 && (
						<Dropdown.Item
							id="all"
							textValue={t`Add all`}
							onAction={() => add(missing)}
							className="border-t border-separator"
						>
							<Icon name="plus" className="text-muted" />
							<Label>
								<Trans>Add all ({missing.length})</Trans>
							</Label>
						</Dropdown.Item>
					)}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

/**
 * The sections Add section can fill from the Profile: those the resume doesn't use yet that the Profile has content
 * for, with how many entries come along (the summary counts as one).
 */
export function useSectionsFromProfile(unused: readonly ("summary" | ProfileSectionType)[]) {
	const source = useWriteSource();
	const profile = useBuilderProfile();
	if (source.kind !== "resume" || !profile) return [];
	return unused
		.map((type) => ({
			type,
			count: type === "summary" ? (isBlank(stripHtml(profile.summary.content)) ? 0 : 1) : profile.sections[type].length,
		}))
		.filter((entry) => entry.count > 0);
}

/** The parts that bring a whole section over from the Profile. */
export function sectionParts(profile: ProfileData, type: "summary" | ProfileSectionType): ProfilePart[] {
	if (type === "summary") return [{ kind: "summary" }];
	return (profile.sections[type] as { id: string }[]).map((item) => ({ kind: "item", section: type, id: item.id }));
}
