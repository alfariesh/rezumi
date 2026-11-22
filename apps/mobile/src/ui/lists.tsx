import type { IconName } from "./icon";
// Grouped rows (Settings, Profile, detail sheets): HeroUI's ListGroup on a surface, rows split by a separator that
// starts under the text. A row is the 40 pt icon tile, the text and the control, like the web's RowIcon rows.
import type { ReactNode } from "react";
import { ListGroup, Separator } from "heroui-native";
import { Children, Fragment, isValidElement } from "react";
import { View } from "react-native";
import { cx } from "./cx";
import { Icon } from "./icon";
import { Text } from "./text";

export { ListGroup, Separator } from "heroui-native";

export type ListRowProps = {
	title: string;
	description?: string | undefined;
	/** A leading icon in a 40 pt tile. */
	icon?: IconName | undefined;
	/** Custom leading content (an avatar, a stage dot) instead of the icon tile. */
	leading?: ReactNode;
	/** A short value at the end (the current choice of a picker row). */
	value?: string | undefined;
	/** A control at the end (a Switch, a Chip); replaces the chevron. */
	trailing?: ReactNode;
	onPress?: (() => void) | undefined;
	/** Shows the chevron for rows that open another screen. Defaults to true when the row has `onPress`. */
	chevron?: boolean | undefined;
	/** Destructive rows (Sign out, Delete account) read in the danger color, with no chevron. */
	tone?: "default" | "danger" | undefined;
	/**
	 * The current choice in a list of options: a check at the end (unless `trailing` replaces it), and the selected
	 * state for screen readers. Leave it out on rows that aren't choices.
	 */
	isSelected?: boolean | undefined;
	isDisabled?: boolean | undefined;
	accessibilityHint?: string | undefined;
	testID?: string | undefined;
};

export function ListRow({
	title,
	description,
	icon,
	leading,
	value,
	trailing,
	onPress,
	chevron = !!onPress,
	tone = "default",
	isSelected,
	isDisabled = false,
	accessibilityHint,
	testID,
}: ListRowProps) {
	const danger = tone === "danger";
	const end = trailing ?? (isSelected ? <Icon name="check" tone="accent" /> : null);
	return (
		<ListGroup.Item
			onPress={onPress}
			disabled={isDisabled || !onPress}
			// A pressable row is one control; a row holding its own control (a Switch) leaves that control reachable.
			accessible={!!onPress}
			accessibilityRole={onPress ? "button" : "none"}
			accessibilityLabel={onPress ? [title, value, description].filter(Boolean).join(", ") : undefined}
			accessibilityHint={accessibilityHint}
			testID={testID}
			accessibilityState={
				onPress ? { disabled: isDisabled, ...(isSelected === undefined ? {} : { selected: isSelected }) } : undefined
			}
			className={cx("min-h-14", isDisabled && "opacity-50")}
		>
			{leading || icon ? (
				<ListGroup.ItemPrefix>
					{leading ??
						(icon ? (
							<View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
								<Icon name={icon} tone={danger ? "danger" : "foreground"} />
							</View>
						) : null)}
				</ListGroup.ItemPrefix>
			) : null}
			<ListGroup.ItemContent>
				<ListGroup.ItemTitle className={cx(danger && "text-danger")}>{title}</ListGroup.ItemTitle>
				{description ? <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription> : null}
			</ListGroup.ItemContent>
			{value || end || (chevron && !danger) ? (
				<ListGroup.ItemSuffix>
					<View className="flex-row items-center gap-2">
						{value ? (
							<Text tone="muted" numberOfLines={1}>
								{value}
							</Text>
						) : null}
						{end}
						{chevron && !danger && !end ? <Icon name="caret-right" size={16} tone="muted" /> : null}
					</View>
				</ListGroup.ItemSuffix>
			) : null}
		</ListGroup.Item>
	);
}

export type ListSectionProps = {
	/** A group label above the surface (12 pt semibold, muted, sentence case). */
	title?: string | undefined;
	/** A muted note under the surface. */
	footer?: string | undefined;
	children: ReactNode;
};

/** One surface of rows with separators between them. */
export function ListSection({ title, footer, children }: ListSectionProps) {
	const rows = Children.toArray(children).filter(isValidElement);
	return (
		<View className="gap-2">
			{title ? (
				<Text size="xs" weight="semibold" tone="muted" className="px-1" accessibilityRole="header">
					{title}
				</Text>
			) : null}
			<ListGroup>
				{rows.map((row, index) => (
					<Fragment key={row.key ?? index}>
						{index > 0 ? <Separator className="ms-4" /> : null}
						{row}
					</Fragment>
				))}
			</ListGroup>
			{footer ? (
				<Text size="xs" tone="muted" className="px-1 leading-5">
					{footer}
				</Text>
			) : null}
		</View>
	);
}
