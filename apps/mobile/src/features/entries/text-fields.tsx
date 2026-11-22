// Text fields bound to the open source: errors appear after the first blur and say how to fix them.
import type { Website } from "@rezumi/schema/resume/data";
import type { ReactNode } from "react";
import type { TextInputProps } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { useWriteSource } from "./source";
import { ControlField, FieldError, Input, Label, Switch, TextField } from "@/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Says how to fix an email address or a web address rather than only that it's wrong. */
export function useValidators() {
	const { t } = useLingui();
	return {
		email: (value: string) => {
			const email = value.trim();
			if (!email || EMAIL.test(email)) return undefined;
			const [name, domain] = email.split("@");
			if (!name || domain === undefined) return t`Add an @ and the domain, like name@example.com`;
			if (!domain) return t`Add the domain after the @, like ${name}@example.com`;
			return t`Add the domain ending, like ${domain}.com`;
		},
		url: (value: string) => {
			const url = value.trim();
			if (!url) return undefined;
			try {
				const parsed = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`);
				if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) throw new Error();
				return undefined;
			} catch {
				return t`Enter a web address, like example.com`;
			}
		},
	};
}

export type BoundTextProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	/** Checked after the field is first left, then as you type. */
	validate?: ((value: string) => string | undefined) | undefined;
	keyboardType?: TextInputProps["keyboardType"];
	autoComplete?: TextInputProps["autoComplete"];
	autoCapitalize?: TextInputProps["autoCapitalize"];
	placeholder?: string | undefined;
	autoFocus?: boolean | undefined;
	disabled?: boolean | undefined;
	onBlur?: (() => void) | undefined;
	/** A small control at the end of the label's line (the Profile marker), kept outside the label. */
	labelAction?: ReactNode;
	testID?: string | undefined;
};

type LabelLineProps = { label: string; action?: ReactNode };

/** A field's label with an optional control at the end of its line. */
export function LabelLine({ label, action }: LabelLineProps) {
	if (!action) return <Label>{label}</Label>;
	return (
		<View className="min-h-6 flex-row items-center justify-between gap-2">
			<Label className="shrink">{label}</Label>
			{action}
		</View>
	);
}

/** A labelled text field bound to the source, on a white surface (cards and sheets). */
export function BoundText({
	label,
	value,
	onChange,
	validate,
	keyboardType,
	autoComplete,
	autoCapitalize,
	placeholder,
	autoFocus,
	disabled,
	onBlur,
	labelAction,
	testID,
}: BoundTextProps) {
	const { focus } = useWriteSource();
	const [touched, setTouched] = useState(false);
	const error = touched ? validate?.(value) : undefined;
	return (
		<TextField isInvalid={error !== undefined} isDisabled={disabled ?? false}>
			<LabelLine label={label} action={labelAction} />
			<Input
				variant="secondary"
				value={value}
				onChangeText={onChange}
				accessibilityLabel={label}
				placeholder={placeholder}
				keyboardType={keyboardType ?? "default"}
				autoComplete={autoComplete ?? "off"}
				autoCapitalize={autoCapitalize ?? (keyboardType && keyboardType !== "default" ? "none" : "sentences")}
				autoCorrect={!keyboardType || keyboardType === "default"}
				autoFocus={(autoFocus ?? false) && !disabled}
				editable={!disabled}
				testID={testID}
				onFocus={focus.onFocus}
				onBlur={() => {
					setTouched(true);
					focus.onBlur();
					onBlur?.();
				}}
			/>
			{error ? <FieldError>{error}</FieldError> : null}
		</TextField>
	);
}

type LinkValue = Website & { inlineLink?: boolean };

type LinkFieldProps = {
	label: string;
	value: LinkValue;
	onChange: (value: LinkValue) => void;
	/** Entries can print the link on their title instead of on its own line. Basics can't. */
	allowInlineLink?: boolean | undefined;
	autoFocus?: boolean | undefined;
	disabled?: boolean | undefined;
	labelAction?: ReactNode;
};

/** Address, the label printed instead of it, and "Show link in title". https:// is added when left without one. */
export function LinkField({
	label,
	value,
	onChange,
	allowInlineLink = true,
	autoFocus,
	disabled,
	labelAction,
}: LinkFieldProps) {
	const { t } = useLingui();
	const validate = useValidators();
	const inline = value.inlineLink ?? false;

	return (
		<View className="gap-3">
			<BoundText
				label={label}
				labelAction={labelAction}
				value={value.url}
				placeholder="https://"
				keyboardType="url"
				autoFocus={autoFocus}
				disabled={disabled}
				validate={validate.url}
				onChange={(url) => onChange({ ...value, url })}
				onBlur={() => {
					const url = value.url.trim();
					if (url && !/^[a-z]+:\/\//i.test(url) && !validate.url(url)) onChange({ ...value, url: `https://${url}` });
				}}
			/>
			{!inline ? (
				<BoundText
					label={t`Link label`}
					value={value.label}
					disabled={disabled}
					onChange={(next) => onChange({ ...value, label: next })}
				/>
			) : null}
			{allowInlineLink ? (
				<ControlField
					isSelected={inline}
					isDisabled={(disabled ?? false) || !value.url.trim()}
					onSelectedChange={(inlineLink) => onChange({ ...value, inlineLink })}
				>
					<Label className="flex-1">{t`Show link in title`}</Label>
					<ControlField.Indicator>
						<Switch />
					</ControlField.Indicator>
				</ControlField>
			) : null}
		</View>
	);
}
