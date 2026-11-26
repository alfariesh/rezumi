import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Button, Card, IconButton, Input, Label, ListRow, Switch, TextArea, TextField, Typography } from "@/ui";

type FieldProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	max?: number | undefined;
	multiline?: boolean;
	keyboard?: TextInputProps["keyboardType"];
	action?: ReactNode;
	testID?: string;
};
export function Field({ label, value, onChange, max, multiline, keyboard, action, testID }: FieldProps) {
	const props = {
		value,
		onChangeText: onChange,
		maxLength: max,
		accessibilityLabel: label,
		keyboardType: keyboard,
		testID,
	};
	return (
		<TextField>
			<View className="flex-row items-center justify-between gap-2">
				<Label>{label}</Label>
				{action}
			</View>
			{multiline ? <TextArea {...props} numberOfLines={4} /> : <Input {...props} />}
		</TextField>
	);
}

type GroupProps = { title: string; children: ReactNode; action?: ReactNode };
export function Group({ title, children, action }: GroupProps) {
	return (
		<Card className="gap-3">
			<View className="flex-row flex-wrap items-center justify-between gap-2">
				<Typography.Heading type="h5">{title}</Typography.Heading>
				{action}
			</View>
			{children}
		</Card>
	);
}

type ToggleProps = { label: string; value: boolean; onChange: (selected: boolean) => void; disabled?: boolean };
export function Toggle({ label, value, onChange, disabled }: ToggleProps) {
	return (
		<ListRow
			title={label}
			trailing={
				<Switch
					accessibilityLabel={label}
					isSelected={value}
					isDisabled={disabled ?? false}
					onSelectedChange={onChange}
				/>
			}
		/>
	);
}

type OrderProps = { up?: (() => void) | undefined; down?: (() => void) | undefined; remove?: (() => void) | undefined };
export function Order({ up, down, remove }: OrderProps) {
	const { t } = useLingui();
	return (
		<View className="flex-row flex-wrap gap-1">
			{up ? <IconButton icon="arrow-up" label={t`Move up`} onPress={up} /> : null}
			{down ? <IconButton icon="arrow-down" label={t`Move down`} onPress={down} /> : null}
			{remove ? <Button size="sm" variant="secondary" onPress={remove}>{t`Remove`}</Button> : null}
		</View>
	);
}
