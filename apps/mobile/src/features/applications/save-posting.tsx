// Save a job, first step: paste a job link (read from the page's own job data, no AI needed) or the posting's text
// (read with your AI provider), or fill the details in by hand. Nothing is saved until Save job.
import type { SaveJob } from "./save-job";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { FormField } from "./detail/form-field";
import { isLink } from "./save-job";
import { useHasAIProvider } from "@/features/ai/provider-state";
import { routes } from "@/routes";
import { Alert, Button, Segment, Spinner, Text } from "@/ui";

type SavePostingProps = { job: SaveJob };

export function SavePosting({ job }: SavePostingProps) {
	const { t } = useLingui();
	const router = useRouter();
	const providers = useHasAIProvider();
	const reading = job.busy === "read";
	const canRead = job.input.trim() && (job.mode === "link" ? isLink(job.input) : providers.hasAIProvider);
	return (
		<View className="gap-4 pb-2">
			<Text tone="muted">{t`Paste a job link or the posting's text, then check the role and company.`}</Text>
			<Segment
				accessibilityLabel={t`What you paste`}
				value={job.mode}
				options={[
					{ value: "link", label: t`Link` },
					{ value: "text", label: t`Text` },
				]}
				onValueChange={job.setMode}
				isDisabled={reading}
			/>
			{job.mode === "link" ? (
				<FormField
					label={t`Job posting link`}
					value={job.input}
					onChangeText={job.setInput}
					placeholder="https://"
					keyboardType="url"
					autoCapitalize="none"
					autoCorrect={false}
					maxLength={5000}
					isDisabled={reading}
					returnKeyType="go"
					onSubmitEditing={() => canRead && job.read()}
					testID="save-job-link"
				/>
			) : (
				<FormField
					label={t`The posting's text`}
					value={job.input}
					onChangeText={job.setInput}
					multiline
					maxLength={100_000}
					isDisabled={reading}
					testID="save-job-text"
				/>
			)}
			{job.mode === "text" && !providers.hasAIProvider && !providers.isLoading ? (
				<Alert status="accent">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>
							{providers.error
								? t`AI providers couldn't be loaded. Try again, or fill the details in by hand.`
								: t`Connect an AI provider to read pasted text. Filling in by hand works without AI.`}
						</Alert.Title>
					</Alert.Content>
					<Button
						size="sm"
						variant="secondary"
						onPress={providers.error ? providers.retry : () => router.push(routes.account("ai-providers"))}
					>
						<Button.Label>{providers.error ? t`Try again` : t`Connect`}</Button.Label>
					</Button>
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
			<Text size="xs" tone="muted">
				{t`AI reads pasted text only when you ask. Links use the page's own job data without AI.`}
			</Text>
			{reading ? (
				<View className="flex-row items-center gap-3">
					<Spinner size="sm" />
					<Text tone="muted" className="flex-1" accessibilityLiveRegion="polite">
						{t`Reading the posting…`}
					</Text>
					<Button size="sm" variant="ghost" onPress={job.cancel}>
						<Button.Label>{t`Cancel`}</Button.Label>
					</Button>
				</View>
			) : (
				<Button variant="primary" isDisabled={!canRead || job.busy !== null} onPress={job.read} testID="save-job-read">
					<Button.Label>{t`Read posting`}</Button.Label>
				</Button>
			)}
			<Button variant="secondary" isDisabled={job.busy !== null} onPress={job.byHand} testID="save-job-manual">
				<Button.Label>{t`Fill in by hand`}</Button.Label>
			</Button>
		</View>
	);
}
