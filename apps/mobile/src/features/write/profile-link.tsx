// The CV builder's view of the account's Profile (the web's profile-link.tsx; the rules are
// `@rezumi/resume/profile-link`): a calm marker beside a part that differs from the Profile, which opens a sheet with
// the Profile's version, Use Profile's and Save to Profile; a quiet Use Profile's for a blank part the Profile has.
import type { MarkerState } from "@rezumi/resume/profile-link";
import type { ProfileData, ProfilePart } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import type { ReactNode } from "react";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useState } from "react";
import { markerState, takeProfilePartsEdit } from "@rezumi/resume/profile-link";
import { MarkerSheet } from "./profile-marker-sheet";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { useResumeStore } from "@/draft";
import { useWriteData, useWriteSource } from "@/features/entries/source";
import { profileQuery, storeSavedProfile } from "@/features/onboarding/queries";
import { Button, IconButton, showToast } from "@/ui";

type OpenMarker = { part: ProfilePart; state: MarkerState };

type ProfileLink = {
	profile: ProfileData | null;
	open: (marker: OpenMarker) => void;
};

const ProfileContext = createContext<ProfileLink>({ profile: null, open: () => undefined });

type ResumeProfileProviderProps = { children: ReactNode };

/** Reads the Profile once for every marker on the screen, and holds the one marker sheet. */
export function ResumeProfileProvider({ children }: ResumeProfileProviderProps) {
	const session = useSession();
	const { data } = useQuery({ ...profileQuery(session.server), enabled: session.status === "signed-in" });
	const [marker, setMarker] = useState<OpenMarker | null>(null);
	const profile = data?.data ?? null;
	return (
		<ProfileContext value={{ profile, open: setMarker }}>
			{children}
			{profile ? <MarkerSheet marker={marker} profile={profile} onClose={() => setMarker(null)} /> : null}
		</ProfileContext>
	);
}

/** The Profile in the builder; null while it loads. */
export const useBuilderProfile = (): ProfileData | null => use(ProfileContext).profile;

/**
 * Use Profile's: takes the Profile's version of parts, or adds Profile entries the resume doesn't have, in one undo
 * step. `prepare` runs first in the same step (placing a section that wasn't on the page).
 */
export function useTakeProfileParts() {
	const source = useWriteSource();
	return (profile: ProfileData, parts: ProfilePart[], prepare?: (draft: WritableDraft<ResumeData>) => void) => {
		const data = source.getData();
		const edit = data ? takeProfilePartsEdit(data, profile, parts, prepare) : null;
		if (edit) source.update(edit, { newStep: true });
		return edit !== null;
	};
}

/** Save to Profile: sends this resume's pending edits first, since the server reads the resume as saved. */
export function useSaveToProfile() {
	const { t } = useLingui();
	const session = useSession();
	const queryClient = useQueryClient();
	const { mutateAsync, isPending } = useMutation(orpc.profile.savePart.mutationOptions());

	const save = async (part: ProfilePart) => {
		const draft = useResumeStore.getState();
		const resumeId = draft.document?.id;
		if (!resumeId) return false;
		await draft.flush();
		const status = useResumeStore.getState().status;
		if (status === "error" || status === "offline") {
			showToast({ title: t`Couldn't save this resume first, so nothing was sent. Try again.`, variant: "danger" });
			return false;
		}
		try {
			const result = await mutateAsync({ resumeId, part });
			storeSavedProfile(queryClient, session.server, { data: result.data, updatedAt: result.updatedAt });
			if (result.updatedResumes.length > 0) void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			const others = result.updatedResumes.length;
			showToast({
				title:
					others > 0
						? plural(others, {
								one: "Saved to your Profile. # other resume was updated too.",
								other: "Saved to your Profile. # other resumes were updated too.",
							})
						: t`Saved to your Profile.`,
				variant: "success",
			});
			return true;
		} catch {
			showToast({ title: t`Couldn't save to your Profile. Try again.`, variant: "danger" });
			return false;
		}
	};

	return { save, isPending };
}

type ProfileMarkerProps = { part: ProfilePart };

/** The mark beside a part that differs from the Profile; only on an editable resume. */
export function ProfileMarker({ part }: ProfileMarkerProps) {
	const { t } = useLingui();
	const source = useWriteSource();
	const locked = source.useLocked();
	const { profile, open } = use(ProfileContext);
	const take = useTakeProfileParts();
	const state = useWriteData(
		(data) => (source.kind === "resume" && profile && !locked ? markerState(data, profile, part) : null),
		null,
	);
	if (!state || !profile) return null;
	if (state === "fill")
		return (
			<Button
				size="sm"
				variant="ghost"
				className="-my-2"
				accessibilityHint={t`Fills it in from your Profile`}
				onPress={() => take(profile, [part])}
			>
				{t`Use Profile's`}
			</Button>
		);
	return (
		<IconButton
			size="sm"
			icon="link-break"
			className="-my-2"
			label={state === "save" ? t`Not in your Profile yet` : t`Differs from your Profile`}
			onPress={() => open({ part, state })}
			testID="profile-marker"
		/>
	);
}
