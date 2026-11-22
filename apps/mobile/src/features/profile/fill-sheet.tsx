// Fill from a resume (`profile.fillFromResume`): the server copies what the Profile doesn't have yet from one resume,
// never replacing what's there. It reads the saved Profile, so unsent edits go first.
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { profileAccount } from "./account";
import { openProfile, saveProfileNow } from "./store";
import { client } from "@/api/client";
import { useSession } from "@/auth/session";
import { useDocuments } from "@/features/documents/queries";
import { storeSavedProfile } from "@/features/onboarding/queries";
import { EmptyState, ListRow, ListSection, Sheet, Skeleton, Text, showToast } from "@/ui";

type FillSheetProps = { isOpen: boolean; onOpenChange: (isOpen: boolean) => void };

export function FillFromResumeSheet({ isOpen, onOpenChange }: FillSheetProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const queryClient = useQueryClient();
	const documents = useDocuments();
	const [busy, setBusy] = useState<string | null>(null);
	const resumes = (documents.data ?? []).filter((document) => document.type === "resume");

	const fill = async (resumeId: string, name: string) => {
		setBusy(resumeId);
		const scope = profileAccount();
		try {
			if (!scope || !(await saveProfileNow())) throw new Error("Unsaved");
			const result = await client.profile.fillFromResume({ resumeId }, { context: { scope } });
			// Another account signed in meanwhile: the result is the first account's.
			if (profileAccount() !== scope) return;
			const profile = { data: result.data, updatedAt: result.updatedAt };
			storeSavedProfile(queryClient, server, profile);
			openProfile(profile, server, queryClient);
			onOpenChange(false);
			showToast({ title: t`Filled in from “${name}”`, variant: "success" });
		} catch {
			showToast({ title: t`Couldn't fill your Profile. Check your connection and try again.`, variant: "danger" });
		} finally {
			setBusy(null);
		}
	};

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Fill from a resume`}
			closeLabel={t`Close`}
			detents={["auto", 0.9]}
		>
			<Text size="xs" tone="muted">
				{t`Adds what your Profile doesn't have yet. Nothing you've written here is replaced.`}
			</Text>
			{documents.isPending ? (
				<Skeleton variant="none" className="h-36 rounded-2xl" />
			) : documents.isError ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't load your resumes.`}
					action={{ label: t`Retry`, onPress: () => void documents.refetch() }}
				/>
			) : resumes.length === 0 ? (
				<EmptyState kind="inline" title={t`You have no resumes yet.`} />
			) : (
				<ListSection>
					{resumes.map((resume) => (
						<ListRow
							key={resume.id}
							title={resume.name}
							icon="file-text"
							value={busy === resume.id ? t`Filling…` : undefined}
							isDisabled={busy !== null}
							chevron={false}
							onPress={() => void fill(resume.id, resume.name)}
						/>
					))}
				</ListSection>
			)}
		</Sheet>
	);
}
