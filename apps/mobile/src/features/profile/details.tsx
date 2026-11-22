// Profile → Details: photo, name, headline, contact details and links, saved as you type. Resumes still using a part
// follow when it changes here.
import { useLingui } from "@lingui/react/macro";
import { SaveNote } from "./save-note";
import { profileWriteSource, useProfileQuery } from "./source";
import { ProfileLoadError, ProfileSkeleton } from "./states";
import { refreshProfile } from "./store";
import { BasicsForm } from "@/features/entries/basics-form";
import { PhotoField } from "@/features/entries/photo-field";
import { WriteSourceProvider } from "@/features/entries/source";
import { Card, Screen, Text } from "@/ui";

export function DetailsPanel() {
	const { t } = useLingui();
	const { query, ready } = useProfileQuery();

	if (!ready && query.isError) return <ProfileLoadError onRetry={() => void query.refetch()} />;
	if (!ready) return <ProfileSkeleton />;

	return (
		<WriteSourceProvider source={profileWriteSource}>
			<Screen onRefresh={refreshProfile} testID="profile-details">
				<SaveNote />
				<Card>
					<Card.Body className="gap-4">
						<PhotoField />
					</Card.Body>
				</Card>
				<Card>
					<Card.Body className="gap-4">
						<Text size="xs" tone="muted">
							{t`New resumes, letters and your portfolio start from these details.`}
						</Text>
						<BasicsForm />
					</Card.Body>
				</Card>
			</Screen>
		</WriteSourceProvider>
	);
}
