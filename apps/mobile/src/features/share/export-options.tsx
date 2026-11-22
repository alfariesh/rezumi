// The parts Download shares between resumes and letters: the format list, the file name, and the notices. Screens
// pass translated strings; the export itself (render, server download, share sheet) lives in `files.ts`.
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Alert, Description, Input, Label, ListRow, ListSection, Text, TextField } from "@/ui";

export type FormatOption<Id extends string> = {
	id: Id;
	label: string;
	description: string;
	/** ".pdf", or "2 files" for a pair. */
	extension: string;
	icon: IconName;
	/** Shown with a lock and "Plus"; choosing it explains the plan instead. */
	locked?: boolean | undefined;
	/** Not available right now (offline, needs the server). */
	unavailable?: boolean | undefined;
};

type FormatListProps<Id extends string> = {
	title: string;
	options: FormatOption<Id>[];
	value: Id;
	disabled: boolean;
	onChange: (id: Id) => void;
};

/** One row per format; the chosen one carries a check, a locked one a lock and "Plus". */
export function FormatList<Id extends string>({ title, options, value, disabled, onChange }: FormatListProps<Id>) {
	const { t } = useLingui();
	return (
		<ListSection title={title}>
			{options.map((option) => (
				<ListRow
					key={option.id}
					testID={`export-format-${option.id}`}
					icon={option.locked ? "lock" : option.icon}
					title={option.locked ? t`${option.label} · Plus` : option.label}
					description={`${option.description} (${option.extension})`}
					isDisabled={disabled || option.unavailable}
					chevron={false}
					isSelected={option.id === value}
					onPress={() => onChange(option.id)}
				/>
			))}
		</ListSection>
	);
}

type FileNameFieldProps = {
	value: string;
	extension: string;
	disabled: boolean;
	description: string;
	onChange: (value: string) => void;
	/** `secondary` on a white surface (a sheet), like every field. */
	variant?: "primary" | "secondary" | undefined;
};

export function FileNameField({ value, extension, disabled, description, onChange, variant }: FileNameFieldProps) {
	const { t } = useLingui();
	return (
		<TextField isDisabled={disabled}>
			<Label>{t`File name`}</Label>
			<View className="flex-row items-center gap-2">
				<View className="flex-1">
					<Input
						variant={variant ?? "primary"}
						value={value}
						onChangeText={onChange}
						maxLength={100}
						autoCorrect={false}
						accessibilityLabel={t`File name`}
						testID="export-file-name"
					/>
				</View>
				<Text mono tone="muted">
					{extension}
				</Text>
			</View>
			<Description>{description}</Description>
		</TextField>
	);
}

type NoticeProps = { status: "accent" | "warning" | "danger"; title?: string | undefined; message: string };

export function Notice({ status, title, message }: NoticeProps) {
	return (
		<Alert status={status}>
			<Alert.Indicator />
			<Alert.Content>
				{title ? <Alert.Title>{title}</Alert.Title> : null}
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
