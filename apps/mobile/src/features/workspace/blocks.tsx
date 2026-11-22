// Small pieces every workspace part uses (web career/shared.tsx), composed from @/ui: a titled card, a wrapping row of
// buttons, a ticked row, a status chip, a first-run card and a banner.
import type { IconName } from "@/ui";
import type { ReactNode } from "react";
import { View } from "react-native";
import {
	Alert,
	Button,
	Card,
	Checkbox,
	ControlField,
	Chip,
	Description,
	Icon,
	Label,
	Spinner,
	Text,
	Typography,
	cx,
} from "@/ui";

type BlockProps = { title?: string | undefined; trailing?: ReactNode; children: ReactNode; testID?: string };

/** A card with an optional title row. */
export function Block({ title, trailing, children, testID }: BlockProps) {
	return (
		<Card className="gap-3" testID={testID}>
			{title || trailing ? (
				<View className="min-h-6 flex-row items-center gap-2">
					{title ? (
						<Typography.Heading type="h6" accessibilityRole="header" className="flex-1">
							{title}
						</Typography.Heading>
					) : (
						<View className="flex-1" />
					)}
					{trailing}
				</View>
			) : null}
			{children}
		</Card>
	);
}

/** A row of buttons that wraps. */
export function Actions({ children }: { children: ReactNode }) {
	return <View className="flex-row flex-wrap items-center gap-2">{children}</View>;
}

type CheckRowProps = {
	label: string;
	detail?: string | undefined;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean | undefined;
	/** Crosses the label out when ticked (plan rows). */
	strike?: boolean | undefined;
	trailing?: ReactNode;
};

/** A ticked row: the whole row toggles, and reads as one labelled checkbox. */
export function CheckRow({
	label,
	detail,
	checked,
	onChange,
	disabled = false,
	strike = false,
	trailing,
}: CheckRowProps) {
	return (
		<ControlField
			isSelected={checked}
			onSelectedChange={onChange}
			isDisabled={disabled}
			accessibilityLabel={detail ? `${label}, ${detail}` : label}
			className="min-h-11 items-start py-1"
		>
			<ControlField.Indicator className="pt-0.5">
				<Checkbox />
			</ControlField.Indicator>
			<View className="flex-1 gap-0.5">
				<Label className={cx(checked && strike && "text-muted line-through")}>{label}</Label>
				{detail ? <Description>{detail}</Description> : null}
			</View>
			{trailing}
		</ControlField>
	);
}

export type PillTone = "accent" | "warning" | "success" | "danger" | "default";

type PillProps = { tone: PillTone; label: string; icon?: IconName | undefined };

/** A small status label: colour, icon and words together, never colour alone. */
export function Pill({ tone, label, icon }: PillProps) {
	return (
		<Chip size="sm" variant="soft" color={tone} className="self-start">
			{icon ? <Icon name={icon} size={14} tone={tone === "default" ? "muted" : `${tone}-soft-foreground`} /> : null}
			<Chip.Label>{label}</Chip.Label>
		</Chip>
	);
}

type FirstRunProps = { title: string; description?: string | undefined; children?: ReactNode; testID?: string };

/** A dashed first-run card: what the part does and the one action that starts it. */
export function FirstRun({ title, description, children, testID }: FirstRunProps) {
	return (
		<View testID={testID} className="items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-8">
			<Typography.Heading type="h5" className="text-center">
				{title}
			</Typography.Heading>
			{description ? (
				<Typography type="body-sm" color="muted" className="max-w-sm text-center">
					{description}
				</Typography>
			) : null}
			{children ? <View className="w-full items-center gap-3">{children}</View> : null}
		</View>
	);
}

type NoticeProps = {
	status?: "default" | "accent" | "success" | "warning" | "danger";
	icon?: IconName | undefined;
	title?: string | undefined;
	message: string;
	action?: { label: string; onPress: () => void } | undefined;
	testID?: string;
};

/** A banner (HeroUI Alert) with an optional title and one small action. */
export function Notice({ status = "accent", icon, title, message, action, testID }: NoticeProps) {
	return (
		<Alert status={status} testID={testID}>
			<Alert.Indicator>
				{icon ? <Icon name={icon} size={18} tone={status === "default" ? "muted" : status} /> : undefined}
			</Alert.Indicator>
			<Alert.Content>
				{title ? <Alert.Title>{title}</Alert.Title> : null}
				<Alert.Description>{message}</Alert.Description>
				{action ? (
					<Button size="sm" variant="secondary" className="mt-2 self-start" onPress={action.onPress}>
						<Button.Label>{action.label}</Button.Label>
					</Button>
				) : null}
			</Alert.Content>
		</Alert>
	);
}

/** A caption line under a control. */
export function Caption({ children }: { children: string }) {
	return (
		<Text size="xs" tone="muted">
			{children}
		</Text>
	);
}

type ActionButtonProps = {
	label: string;
	onPress: () => void;
	icon?: IconName | undefined;
	variant?: "primary" | "secondary" | "tertiary" | "ghost" | "outline" | "danger-soft" | undefined;
	size?: "sm" | "md" | undefined;
	/** Shows a spinner in place of the icon and blocks presses. */
	busy?: boolean | undefined;
	disabled?: boolean | undefined;
	/** Stretches to the full width (the part's main action). */
	full?: boolean | undefined;
	testID?: string | undefined;
};

/** A labelled button with an optional icon, and a spinner while its work runs. */
export function ActionButton({
	label,
	onPress,
	icon,
	variant = "secondary",
	size = "sm",
	busy = false,
	disabled = false,
	full = false,
	testID,
}: ActionButtonProps) {
	return (
		<Button
			size={size}
			variant={variant}
			isDisabled={disabled || busy}
			onPress={onPress}
			className={full ? "self-stretch" : "self-start"}
			accessibilityState={{ busy, disabled: disabled || busy }}
			testID={testID}
		>
			{busy ? (
				<Spinner size="sm" />
			) : icon ? (
				<Icon
					name={icon}
					size={16}
					tone={variant === "primary" ? "accent-foreground" : variant === "danger-soft" ? "danger" : "foreground"}
				/>
			) : null}
			<Button.Label>{label}</Button.Label>
		</Button>
	);
}
