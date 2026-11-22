// New → import's progress, then its outcome, as the web's import step: the file with Cancel while it reads, then the
// counts found with Open in editor, or the error with a way forward (Start blank, Choose another file).
import type { ImportStep } from "./use-import";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Alert, Button, Icon, Spinner, Text, Typography } from "@/ui";

type NewImportProps = {
	step: Exclude<ImportStep, { name: "idle" }>;
	creating: boolean;
	onCancel: () => void;
	onChooseFile: () => void;
	onStartBlank: () => void;
	onOpen: () => void;
	onStay: () => void;
};

export function NewImport({ step, creating, onCancel, onChooseFile, onStartBlank, onOpen, onStay }: NewImportProps) {
	const { t } = useLingui();
	const title = step.name === "failed" ? t`Couldn't import` : step.name === "imported" ? t`Imported` : t`Importing`;
	return (
		<View className="gap-4" testID={`new-import-${step.name}`}>
			<Typography.Heading type="h4" accessibilityRole="header">
				{title}
			</Typography.Heading>
			{step.file ? (
				<View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border px-3 py-2">
					<Icon name={step.file.name.toLowerCase().endsWith(".pdf") ? "file-pdf" : "file-text"} tone="muted" />
					<Text weight="medium" numberOfLines={1} className="flex-1">
						{step.file.name}
					</Text>
					{step.name === "importing" ? (
						<Button size="sm" variant="ghost" onPress={onCancel}>
							<Button.Label>{t`Cancel`}</Button.Label>
						</Button>
					) : null}
				</View>
			) : null}
			{step.name === "importing" ? (
				<View accessibilityLiveRegion="polite" className="flex-row items-center gap-3">
					<Spinner size="sm" />
					<Text tone="muted">{t`Reading the file and finding sections…`}</Text>
				</View>
			) : null}
			{step.name === "failed" ? (
				<>
					<Alert status="danger">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Description>{step.message}</Alert.Description>
						</Alert.Content>
					</Alert>
					<View className="gap-2">
						<Button onPress={onChooseFile}>
							<Button.Label>{t`Choose another file`}</Button.Label>
						</Button>
						<Button variant="secondary" isDisabled={creating} onPress={onStartBlank}>
							<Button.Label>{t`Start blank`}</Button.Label>
						</Button>
					</View>
				</>
			) : null}
			{step.name === "imported" ? (
				<>
					<View accessibilityRole="text" accessibilityLiveRegion="polite" className="flex-row gap-2">
						<Icon name="check-circle" tone="success" />
						<Typography type="body-sm" className="flex-1">
							{step.summary
								? `${t`Found ${plural(step.summary.sections, { one: "# section", other: "# sections" })} and ${plural(step.summary.entries, { one: "# entry", other: "# entries" })}.`}${
										step.summary.flagged > 0
											? ` ${plural(step.summary.flagged, {
													one: "# field is flagged for a quick look in the editor.",
													other: "# fields are flagged for a quick look in the editor.",
												})}`
											: ""
									}`
								: t`Your document was saved. Review it in the editor.`}
						</Typography>
					</View>
					<View className="gap-2">
						<Button onPress={onOpen}>
							<Button.Label>{t`Open in editor`}</Button.Label>
						</Button>
						<Button variant="secondary" onPress={onStay}>
							<Button.Label>{t`Stay here`}</Button.Label>
						</Button>
					</View>
				</>
			) : null}
		</View>
	);
}
