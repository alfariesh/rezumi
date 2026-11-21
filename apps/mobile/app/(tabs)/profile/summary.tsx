import { useLingui } from "@lingui/react/macro";
import { SummaryEditor } from "@/features/entries/entry-editor";
import { WriteSourceProvider } from "@/features/entries/source";
import { profileWriteSource } from "@/features/profile/source";

/** The Profile's summary (Profile → Career). */
export default function ProfileSummaryRoute() {
	const { t } = useLingui();
	return (
		<WriteSourceProvider source={profileWriteSource}>
			<SummaryEditor title={t`Summary`} hint={t`2–3 sentences reads best`} />
		</WriteSourceProvider>
	);
}
