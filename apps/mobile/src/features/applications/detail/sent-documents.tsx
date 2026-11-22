// What you sent (the web's detail/sent-documents.tsx): the linked resume and letter, opening the version sent when
// there is one (linked is not the same as sent), or ways to prepare them.
import type { Application } from "../types";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { PIPELINE } from "@rezumi/career/applications";
import { useUserTime } from "../date";
import { useDetailMutations, useDocuments } from "../queries";
import { DetailSection } from "./section";
import { routes } from "@/routes";
import { Button, Icon, ListRow, ListSection, showToast } from "@/ui";

/** When it was sent: its first stage entry at Applied or beyond. */
function sentOn(application: Application) {
	const applied = PIPELINE.indexOf("applied");
	const entry = application.activity
		.toSorted((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
		.find((item) => item.type === "stage" && PIPELINE.indexOf(item.stage) >= applied);
	return entry?.at ?? application.appliedAt;
}

type SentDocumentsProps = { application: Application };

export function SentDocuments({ application }: SentDocumentsProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { utcDay } = useUserTime();
	const documents = useDocuments();
	const { createLetter } = useDetailMutations(application.id);
	const { resumeId, coverLetterId, sentResumeVersionId, sentCoverLetterVersionId } = application;
	const resume = documents.data?.find((item) => item.type === "resume" && item.id === resumeId);
	const letter = documents.data?.find((item) => item.type === "letter" && item.id === coverLetterId);
	const date = utcDay(sentOn(application));

	const writeLetter = () =>
		createLetter.mutate(
			{
				name: t`Cover letter — ${application.company}`.slice(0, 100),
				applicationId: application.id,
				...(resumeId ? { resumeId } : {}),
			},
			{
				onSuccess: (created) => router.push(routes.letter(created.id)),
				onError: () => showToast({ title: t`Couldn't create the letter. Try again.`, variant: "danger" }),
			},
		);

	return (
		<DetailSection title={application.status === "saved" ? t`Documents for this job` : t`What you sent`} testID="sent">
			{resumeId || coverLetterId ? (
				<ListSection>
					{resumeId ? (
						<ListRow
							icon="file-text"
							title={resume?.name ?? t`Linked resume`}
							description={
								sentResumeVersionId
									? application.sentCheckScore !== null
										? t`Version sent ${date} · Check ${application.sentCheckScore}`
										: t`Version sent ${date}`
									: t`Linked · not sent yet`
							}
							onPress={() =>
								router.push(
									sentResumeVersionId ? routes.history(resumeId, sentResumeVersionId) : routes.builder(resumeId),
								)
							}
						/>
					) : null}
					{coverLetterId ? (
						<ListRow
							icon="envelope-simple"
							title={letter?.name ?? t`Cover letter`}
							description={sentCoverLetterVersionId ? t`Version sent ${date}` : t`Linked · not sent yet`}
							onPress={() => router.push(routes.letter(coverLetterId, "write", sentCoverLetterVersionId ?? undefined))}
						/>
					) : null}
				</ListSection>
			) : null}
			{!resumeId || !coverLetterId ? (
				<View className="flex-row flex-wrap gap-2">
					{!resumeId ? (
						<Button size="sm" variant="secondary" onPress={() => router.push(routes.newCopyForJob(application.id))}>
							<Icon name="copy" size={16} />
							<Button.Label>{t`Prepare a resume`}</Button.Label>
						</Button>
					) : null}
					{!coverLetterId ? (
						<Button size="sm" variant="secondary" isDisabled={createLetter.isPending} onPress={writeLetter}>
							<Icon name="envelope-simple" size={16} />
							<Button.Label>{t`Write a letter`}</Button.Label>
						</Button>
					) : null}
				</View>
			) : null}
		</DetailSection>
	);
}
