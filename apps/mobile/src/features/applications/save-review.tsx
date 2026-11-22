// Save a job, second step: the details read from the posting (or typed by hand) to check and edit, the stage it's at,
// and more details on request; Save job creates the application.
import type { SaveJob, SaveStage } from "./save-job";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { DocumentChoice } from "./detail/document-choice";
import { FormField } from "./detail/form-field";
import { MAX_DESCRIPTION } from "./save-job";
import { getStageLabel } from "./stages";
import { useHasAIProvider } from "@/features/ai/provider-state";
import { Alert, Button, ChipInput, DatePicker, ListSection, Segment, Text } from "@/ui";

type SaveReviewProps = { job: SaveJob };

const STAGES = ["saved", "applied", "interview"] as const satisfies readonly SaveStage[];

export function SaveReview({ job }: SaveReviewProps) {
	const { t, i18n } = useLingui();
	const providers = useHasAIProvider();
	const [more, setMore] = useState(!job.validUrl);
	const { fields, set, parsed } = job;
	const locked = job.busy !== null;
	return (
		<View className="gap-4 pb-2">
			{parsed ? (
				<Alert status={parsed.enrichmentWarning || parsed.filledBy === "none" ? "warning" : "accent"}>
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>
							{parsed.enrichmentWarning
								? t`AI couldn't read everything. Check the details, or fill them in by hand.`
								: t`Check the details before saving. A saved page doesn't prove the job is still open.`}
						</Alert.Title>
					</Alert.Content>
				</Alert>
			) : null}
			{job.error ? (
				<Alert status="danger" testID="save-job-error">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>{job.error}</Alert.Title>
					</Alert.Content>
				</Alert>
			) : null}
			<FormField
				label={t`Role`}
				value={fields.role}
				onChangeText={set("role")}
				isRequired
				isDisabled={locked}
				testID="save-job-role"
			/>
			<FormField
				label={t`Company`}
				value={fields.company}
				onChangeText={set("company")}
				isRequired
				isDisabled={locked}
				testID="save-job-company"
			/>
			<Segment
				accessibilityLabel={t`Stage`}
				value={job.stage}
				options={STAGES.map((stage) => ({ value: stage, label: getStageLabel(stage) }))}
				onValueChange={job.setStage}
				isDisabled={locked}
			/>
			{job.stage !== "saved" ? (
				<DatePicker
					label={t`Application date`}
					value={job.stageDate}
					onChange={job.setStageDate}
					placeholder={t`Choose a day`}
					locale={i18n.locale}
					variant="secondary"
					isInvalid={!job.validDate}
					errorMessage={t`Choose the day you applied.`}
				/>
			) : null}
			<Button
				variant="ghost"
				className="self-start"
				onPress={() => setMore((value) => !value)}
				accessibilityState={{ expanded: more }}
			>
				<Button.Label>{more ? t`Fewer details` : t`More details`}</Button.Label>
			</Button>
			{more ? (
				<View className="gap-4">
					<FormField label={t`Location`} value={fields.location} onChangeText={set("location")} isDisabled={locked} />
					<FormField label={t`Salary`} value={fields.salary} onChangeText={set("salary")} isDisabled={locked} />
					<FormField label={t`Source`} value={fields.source} onChangeText={set("source")} isDisabled={locked} />
					<FormField
						label={t`Posting link`}
						value={fields.sourceUrl}
						onChangeText={set("sourceUrl")}
						keyboardType="url"
						autoCapitalize="none"
						autoCorrect={false}
						isDisabled={locked}
						error={job.validUrl ? null : t`Use an http or https link.`}
					/>
					<ListSection>
						<DocumentChoice type="resume" label={t`Resume`} value={fields.resumeId} onChange={set("resumeId")} />
						{job.stage !== "saved" ? (
							<DocumentChoice type="letter" label={t`Letter sent`} value={fields.letterId} onChange={set("letterId")} />
						) : null}
					</ListSection>
					<ChipInput
						label={t`Tags`}
						values={job.tags}
						onChange={job.setTags}
						removeLabel={(tag) => t`Remove ${tag}`}
						placeholder={t`Add a tag`}
						variant="secondary"
					/>
					<FormField label={t`Notes`} value={fields.notes} onChangeText={set("notes")} multiline isDisabled={locked} />
					<FormField
						label={t`Job description`}
						value={fields.description}
						onChangeText={set("description")}
						multiline
						isDisabled={locked}
					/>
					{job.clipped ? (
						<Text size="xs" tone="warning">
							{t`Only the first ${MAX_DESCRIPTION} characters are saved.`}
						</Text>
					) : null}
					{providers.hasAIProvider ? (
						<Button
							variant="secondary"
							isDisabled={locked || !fields.description.trim() || job.clipped}
							onPress={job.fill}
						>
							<Button.Label>{job.busy === "fill" ? t`Filling in…` : t`Fill empty fields with AI`}</Button.Label>
						</Button>
					) : null}
				</View>
			) : null}
		</View>
	);
}
