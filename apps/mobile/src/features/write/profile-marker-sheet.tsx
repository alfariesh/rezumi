// The sheet a Profile marker opens: what differs, the Profile's version, then Save to Profile and Use Profile's.
import type { MarkerState } from "@rezumi/resume/profile-link";
import type { ProfileData, ProfilePart } from "@rezumi/schema/profile/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { profilePreview } from "@rezumi/resume/profile-link";
import { useSaveToProfile, useTakeProfileParts } from "./profile-link";
import { useSession } from "@/auth/session";
import { resolvePictureUrl } from "@/features/entries/photo-field";
import { useWriteSource } from "@/features/entries/source";
import { Avatar, Button, Sheet, Surface, Text, Typography, showToast } from "@/ui";

type MarkerSheetProps = {
	marker: { part: ProfilePart; state: MarkerState } | null;
	profile: ProfileData;
	onClose: () => void;
};

export function MarkerSheet({ marker, profile, onClose }: MarkerSheetProps) {
	const { t } = useLingui();
	const source = useWriteSource();
	const take = useTakeProfileParts();
	const { save, isPending } = useSaveToProfile();
	// The last marker stays drawn while the sheet slides away.
	const [shown, setShown] = useState(marker);
	if (marker && marker !== shown) setShown(marker);
	const current = marker ?? shown;
	const state = current?.state ?? "both";
	const label = state === "save" ? t`Not in your Profile yet` : t`Differs from your Profile`;

	const takeProfiles = () => {
		onClose();
		if (current && take(profile, [current.part]))
			showToast({ title: t`Using your Profile's version.`, undo: { label: t`Undo`, onUndo: source.undo } });
	};

	return (
		// Mounted once per screen, so the native sheet exists before a marker opens it.
		<Sheet
			isOpen={marker !== null}
			onOpenChange={(open) => !open && onClose()}
			title={label}
			closeLabel={t`Close`}
			testID="profile-marker-sheet"
		>
			{current ? (
				<>
					{state === "both" ? <ProfileVersion part={current.part} profile={profile} /> : null}
					<Typography type="body-sm" className="text-muted">
						{state === "save"
							? t`Save it to your Profile to use it in new resumes, letters and your portfolio.`
							: t`Changes made here stay in this resume.`}
					</Typography>
					<View className="gap-2">
						{state === "both" ? <Button onPress={takeProfiles}>{t`Use Profile's`}</Button> : null}
						<Button
							variant="secondary"
							isDisabled={isPending}
							onPress={() => void save(current.part).then((saved) => saved && onClose())}
						>
							{isPending ? t`Saving…` : t`Save to Profile`}
						</Button>
					</View>
				</>
			) : null}
		</Sheet>
	);
}

type ProfileVersionProps = { part: ProfilePart; profile: ProfileData };

/** The Profile's version of a part, as a short preview under "In your Profile". */
function ProfileVersion({ part, profile }: ProfileVersionProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const photo = part.kind === "picture" ? resolvePictureUrl(profile.picture.url, server) : "";
	return (
		<Surface variant="secondary" className="gap-1 rounded-xl p-3">
			<Text size="xs" tone="muted">
				{t`In your Profile`}
			</Text>
			{part.kind === "picture" ? (
				<Avatar size="lg" alt={t`Your Profile's photo`}>
					{photo ? <Avatar.Image source={{ uri: photo }} /> : null}
					<Avatar.Fallback>{"?"}</Avatar.Fallback>
				</Avatar>
			) : (
				<Typography type="body-sm">{profilePreview(profile, part)}</Typography>
			)}
		</Surface>
	);
}
