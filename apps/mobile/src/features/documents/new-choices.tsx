// New's choices, in the web dialog's words: Import a resume first (the filled tile), then New resume, New letter,
// Copy a resume for a job and Save a job, then the quieter Try with a sample resume and the ATS checker.
import type { useHasAIProvider } from "@/features/ai/providers";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AIProviderSetupSheet } from "@/features/ai/providers";
import { Button, Icon, ListRow, ListSection, Switch, Text, Typography } from "@/ui";

type NewChoicesProps = {
	busy: boolean;
	ai: ReturnType<typeof useHasAIProvider>;
	aiPdf: boolean;
	onAiPdfChange: (aiPdf: boolean) => void;
	onImport: () => void;
	onStartBlank: () => void;
	onNewLetter: () => void;
	onTrySample: () => void;
	onCopy: () => void;
	onSaveJob: () => void;
	onAtsChecker: () => void;
};

export function NewChoices(props: NewChoicesProps) {
	const { t } = useLingui();
	const { busy, ai } = props;
	const [setup, setSetup] = useState(false);
	return (
		<View className="gap-5">
			<View className="gap-2">
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t`Import a resume`}
					accessibilityHint={t`Choose a PDF, Word, JSON or LinkedIn export file`}
					accessibilityState={{ disabled: busy }}
					disabled={busy}
					onPress={props.onImport}
					className="flex-row items-start gap-4 rounded-2xl border border-dashed border-border bg-surface p-4 active:bg-accent-soft"
					testID="new-import"
				>
					<View className="size-11 items-center justify-center rounded-xl bg-default">
						<Icon name="file-arrow-up" size={24} tone="muted" />
					</View>
					<View className="flex-1 gap-1">
						<Typography.Heading type="h6">{t`Import a resume`}</Typography.Heading>
						<Typography type="body-sm" color="muted">
							{t`PDF, Word, Rezumi, JSON Resume or LinkedIn export. We fill in every section and flag anything we're unsure of. Up to 10 MB.`}
						</Typography>
					</View>
				</Pressable>
				{ai.hasAIProvider ? (
					<ListSection
						footer={t`Sends PDFs to your AI provider instead of reading their text layer. Word files always need it.`}
					>
						<ListRow
							title={t`Use AI for PDF imports`}
							trailing={
								<Switch
									isSelected={props.aiPdf}
									onSelectedChange={props.onAiPdfChange}
									isDisabled={busy}
									accessibilityLabel={t`Use AI for PDF imports`}
								/>
							}
						/>
					</ListSection>
				) : (
					<View className="flex-row flex-wrap items-center gap-x-2 px-1">
						<Text size="xs" tone="muted" className="shrink">
							{t`Word files need an AI provider. PDFs are read from their text layer.`}
						</Text>
						<Button size="sm" variant="ghost" isDisabled={busy || ai.isLoading} onPress={() => setSetup(true)}>
							<Button.Label>{t`Set up AI provider`}</Button.Label>
						</Button>
					</View>
				)}
			</View>
			<ListSection>
				<ListRow
					icon="file-plus"
					title={t`New resume`}
					description={t`Starts from your Profile. Change anything for this resume.`}
					chevron={false}
					isDisabled={busy}
					onPress={props.onStartBlank}
					testID="new-resume"
				/>
				<ListRow
					icon="envelope-simple"
					title={t`New letter`}
					description={t`Takes its sender details and design from your latest resume.`}
					chevron={false}
					isDisabled={busy}
					onPress={props.onNewLetter}
					testID="new-letter"
				/>
				<ListRow
					icon="copy"
					title={t`Copy a resume for a job`}
					description={t`Start from one you have and link the application.`}
					isDisabled={busy}
					onPress={props.onCopy}
					testID="new-copy"
				/>
				<ListRow
					icon="briefcase"
					title={t`Save a job`}
					description={t`Track an application from a link or the posting's text.`}
					isDisabled={busy}
					onPress={props.onSaveJob}
					testID="new-save-job"
				/>
			</ListSection>
			<View className="gap-1">
				<Button variant="ghost" isDisabled={busy} onPress={props.onTrySample}>
					<Icon name="sparkle" size={16} />
					<Button.Label>{t`Try with a sample resume`}</Button.Label>
				</Button>
				<Button variant="ghost" isDisabled={busy} onPress={props.onAtsChecker}>
					<Icon name="list-checks" size={16} />
					<Button.Label>{t`Check a PDF with the ATS checker`}</Button.Label>
				</Button>
			</View>
			<AIProviderSetupSheet open={setup} onClose={() => setSetup(false)} />
		</View>
	);
}
