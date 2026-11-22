// Save a job (the web's add-application dialog): paste a link or the posting's text (`applications.ai.parsePosting`),
// check what was read, or fill it in by hand; Save job creates the application. Closing with unsaved details asks
// first. Without `onSaved`, the new application opens in Applications once the sheet has gone.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useSaveJob } from "./save-job";
import { SavePosting } from "./save-posting";
import { SaveReview } from "./save-review";
import { routes } from "@/routes";
import { Button, ConfirmDialog, Sheet } from "@/ui";

export type SaveJobSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	/** After the application is created, with its id. */
	onSaved?: ((applicationId: string) => void) | undefined;
	/** Prefill (a posting link from Jobs or Documents). */
	initialUrl?: string | undefined;
};

export function SaveJobSheet({ isOpen, onOpenChange, onSaved, initialUrl }: SaveJobSheetProps) {
	const { t } = useLingui();
	const router = useRouter();
	const [dirty, setDirty] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const openAfter = useRef<string | null>(null);
	const close = () => {
		setDirty(false);
		onOpenChange(false);
	};
	return (
		<>
			<Sheet
				isOpen={isOpen}
				onOpenChange={(open) => !open && close()}
				title={t`Save a job`}
				closeLabel={t`Close`}
				detents={[0.9]}
				canDismiss={!dirty}
				onDismissAttempt={() => setConfirming(true)}
				onDidDismiss={() => {
					const id = openAfter.current;
					openAfter.current = null;
					if (id) router.push(routes.applicationDetails(id));
				}}
				testID="save-job-sheet"
			>
				{isOpen ? (
					<SaveJobBody
						initialUrl={initialUrl}
						onDirtyChange={setDirty}
						onSaved={(id) => {
							setDirty(false);
							if (onSaved) onSaved(id);
							else {
								openAfter.current = id;
								onOpenChange(false);
							}
						}}
					/>
				) : null}
			</Sheet>
			<ConfirmDialog
				isOpen={confirming}
				onOpenChange={setConfirming}
				title={t`Discard this job?`}
				message={t`The details you entered aren't saved.`}
				confirmLabel={t`Discard`}
				cancelLabel={t`Keep editing`}
				destructive
				onConfirm={close}
			/>
		</>
	);
}

type SaveJobBodyProps = {
	initialUrl: string | undefined;
	onDirtyChange: (dirty: boolean) => void;
	onSaved: (applicationId: string) => void;
};

/** The form; mounted only while the sheet is open, so closing it drops the details and cancels a read. */
export function SaveJobBody({ initialUrl, onDirtyChange, onSaved }: SaveJobBodyProps) {
	const { t } = useLingui();
	const job = useSaveJob(initialUrl);
	useEffect(() => onDirtyChange(job.dirty), [job.dirty, onDirtyChange]);
	if (!job.reviewing) return <SavePosting job={job} />;
	return (
		<View className="gap-4">
			<SaveReview job={job} />
			<Button variant="primary" isDisabled={!job.ready} onPress={() => job.save(onSaved)} testID="save-job-save">
				<Button.Label>{job.busy === "save" ? t`Saving…` : t`Save job`}</Button.Label>
			</Button>
			<Button variant="ghost" isDisabled={job.busy !== null} onPress={job.back}>
				<Button.Label>{t`Back to the posting`}</Button.Label>
			</Button>
		</View>
	);
}
