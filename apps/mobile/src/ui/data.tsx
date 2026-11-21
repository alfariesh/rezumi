// Data display and entry for list rows: HeroUI's Chip, TagGroup and Avatar as shipped, Pro's SwipeableRow with a full
// swipe, and a date field on the system picker (plans/mobile 01-desain 1.2: system components for date pickers).
import type { IconName } from "./icon";
import type { ThemeColor } from "heroui-native";
import type { SwipeableRowOpenSide } from "heroui-native-pro/swipeable-row";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Description, FieldError, Label, useThemeColor } from "heroui-native";
import { SwipeableRow as ProSwipeableRow } from "heroui-native-pro/swipeable-row";
import { useMemo, useState } from "react";
import { I18nManager, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { IconButton } from "./button";
import { cx } from "./cx";
import { Icon } from "./icon";
import { haptics } from "./motion";
import { Text } from "./text";
import { useColorSchemeValue } from "./theme";
import { size } from "./tokens";

export { Avatar, Chip, TagGroup } from "heroui-native";

export type SwipeAction = {
	key: string;
	label: string;
	icon?: IconName | undefined;
	/** `danger` for Delete, `accent` for the main non-destructive action, `default` for the rest. */
	variant?: "default" | "accent" | "success" | "danger" | undefined;
	onPress: () => void;
};

const actionTones = {
	default: "default-foreground",
	accent: "accent-foreground",
	success: "success-foreground",
	danger: "danger-foreground",
} as const satisfies Record<NonNullable<SwipeAction["variant"]>, ThemeColor>;

/** Finger travel, as a share of the row width, past which letting go performs the first action. */
const fullSwipeShare = 0.5;
/** iOS starts its back gesture this close to the screen edge; the row leaves those touches to it. */
const backSwipeEdge = 24;

export type SwipeableRowProps = {
	/**
	 * Trailing actions, uncovered by swiping toward the leading edge (right to left; mirrored in right-to-left layouts).
	 * The first sits at the outer edge and is the one a full swipe performs. One to three actions.
	 */
	actions: readonly SwipeAction[];
	/** Letting go after a long swipe performs the first action (default). Turn off when it cannot be undone. */
	fullSwipe?: boolean | undefined;
	/** Screen-reader action that uncovers the actions ("Show actions"). */
	openActionsLabel: string;
	/** Screen-reader action that hides them ("Hide actions"). */
	closeActionsLabel: string;
	/** `inline` for rows that touch inside one surface (ListGroup); `standalone` (default) for spaced cards. */
	variant?: "standalone" | "inline" | undefined;
	isDisabled?: boolean | undefined;
	className?: string | undefined;
	testID?: string | undefined;
	children: ReactNode;
};

/**
 * A row with actions behind it. Only trailing actions: that swipe runs opposite to the iOS back gesture, and touches that
 * start at the screen edge go to the back gesture, never to the row. Screen readers reach the actions through the
 * row's custom actions.
 */
export function SwipeableRow({
	actions,
	fullSwipe = true,
	openActionsLabel,
	closeActionsLabel,
	variant = "standalone",
	isDisabled = false,
	className,
	testID,
	children,
}: SwipeableRowProps) {
	const [openSide, setOpenSide] = useState<SwipeableRowOpenSide>(null);
	const { width: screenWidth } = useWindowDimensions();
	const width = useSharedValue(0);
	const armed = useSharedValue(false);
	const firstPress = actions[0]?.onPress;

	const gestures = useMemo(() => {
		const rtl = I18nManager.isRTL;
		const perform = () => {
			firstPress?.();
			// After the row's own release has asked to stay open on the actions.
			setTimeout(() => setOpenSide(null), 0);
		};
		// Pans only toward the leading edge, so a back swipe (the other way) never activates it.
		const pan = Gesture.Pan()
			.enabled(fullSwipe && !isDisabled && !!firstPress)
			.activeOffsetX(rtl ? 10 : -10)
			.failOffsetY([-10, 10])
			.onUpdate((event) => {
				"worklet";
				const travel = rtl ? event.translationX : -event.translationX;
				const past = width.get() > 0 && travel >= width.get() * fullSwipeShare;
				if (past === armed.get()) return;
				armed.set(past);
				if (past) scheduleOnRN(haptics.selection);
			})
			.onEnd(() => {
				"worklet";
				if (armed.get()) scheduleOnRN(perform);
			})
			.onFinalize(() => {
				"worklet";
				armed.set(false);
			})
			.withTestId("swipeable-row-full-swipe");
		// Holds the row back while a touch that began at the screen edge is down, so iOS can take it as a back swipe.
		const edge = Gesture.Manual()
			.enabled(Platform.OS === "ios" && !isDisabled)
			.onTouchesDown((event, manager) => {
				"worklet";
				const touch = event.allTouches[0];
				const fromEdge = touch ? (rtl ? screenWidth - touch.absoluteX : touch.absoluteX) : backSwipeEdge;
				if (fromEdge >= backSwipeEdge) manager.fail();
			})
			.onTouchesUp((_event, manager) => {
				"worklet";
				manager.fail();
			})
			.onTouchesCancelled((_event, manager) => {
				"worklet";
				manager.fail();
			});
		return { pan, edge, both: Gesture.Simultaneous(edge, pan) };
	}, [armed, firstPress, fullSwipe, isDisabled, screenWidth, width]);

	const onLayout = (event: LayoutChangeEvent) => width.set(event.nativeEvent.layout.width);

	return (
		<GestureDetector gesture={gestures.both}>
			<View onLayout={onLayout} className={cx(className)} testID={testID}>
				<ProSwipeableRow
					openSide={openSide}
					onOpenSideChange={setOpenSide}
					variant={variant}
					isDisabled={isDisabled}
					simultaneousWithExternalGesture={gestures.pan}
					requireExternalGestureToFail={gestures.edge}
					accessibilityOpenEndActionsLabel={openActionsLabel}
					accessibilityCloseActionsLabel={closeActionsLabel}
				>
					<ProSwipeableRow.Actions side="end">
						{/* The rail puts its first child next to the card; the first action belongs at the outer edge. */}
						{[...actions].reverse().map((action) => {
							const tone = actionTones[action.variant ?? "default"];
							return (
								<ProSwipeableRow.Action
									key={action.key}
									variant={action.variant ?? "default"}
									onPress={action.onPress}
									accessibilityLabel={action.label}
								>
									{action.icon ? <Icon name={action.icon} size={size.icon.md} tone={tone} /> : null}
									<ProSwipeableRow.ActionLabel>{action.label}</ProSwipeableRow.ActionLabel>
								</ProSwipeableRow.Action>
							);
						})}
					</ProSwipeableRow.Actions>
					<ProSwipeableRow.Content>{children}</ProSwipeableRow.Content>
				</ProSwipeableRow>
			</View>
		</GestureDetector>
	);
}

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` as a local date at noon, so no time zone or daylight-saving shift moves it to another day. */
export function parseIsoDate(value: string | null | undefined): Date | null {
	const match = value ? isoDate.exec(value) : null;
	if (!match) return null;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** The local calendar day of a date as `YYYY-MM-DD`. */
export function formatIsoDate(date: Date): string {
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type DatePickerProps = {
	label: string;
	/** `YYYY-MM-DD`, or null when empty. */
	value: string | null;
	onChange: (value: string | null) => void;
	/** Shown while empty ("Add a date"). */
	placeholder: string;
	description?: string | undefined;
	/** Shown under the field while `isInvalid`, with the remedy. */
	errorMessage?: string | undefined;
	isInvalid?: boolean | undefined;
	isRequired?: boolean | undefined;
	isDisabled?: boolean | undefined;
	/** `YYYY-MM-DD` bounds. */
	minimumDate?: string | undefined;
	maximumDate?: string | undefined;
	/** Adds a clear button with this label (optional fields). */
	clearLabel?: string | undefined;
	/** BCP 47 locale for the shown date and the calendar; the device's by default. */
	locale?: string | undefined;
	/** `secondary` on a white surface, like the other fields. */
	variant?: "primary" | "secondary" | undefined;
	testID?: string | undefined;
};

/**
 * A single date on the system picker: Android opens its date dialog, iOS unfolds its inline calendar under the field
 * (as the Calendar app does) and folds it again once a day is picked. Dates go in and out as `YYYY-MM-DD`.
 */
export function DatePicker({
	label,
	value,
	onChange,
	placeholder,
	description,
	errorMessage,
	isInvalid = false,
	isRequired = false,
	isDisabled = false,
	minimumDate,
	maximumDate,
	clearLabel,
	locale,
	variant = "primary",
	testID,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const accent = useThemeColor("accent");
	const scheme = useColorSchemeValue();
	const date = parseIsoDate(value);
	const min = parseIsoDate(minimumDate) ?? undefined;
	const max = parseIsoDate(maximumDate) ?? undefined;
	const shown = date
		? new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date)
		: null;

	const initial = () => {
		const today = parseIsoDate(formatIsoDate(new Date())) ?? new Date();
		if (min && today < min) return min;
		if (max && today > max) return max;
		return today;
	};

	const commit = (picked: Date) => {
		const next = formatIsoDate(picked);
		setOpen(false);
		if (next === value) return;
		haptics.selection();
		onChange(next);
	};

	const press = () => {
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: date ?? initial(),
				mode: "date",
				...(min ? { minimumDate: min } : {}),
				...(max ? { maximumDate: max } : {}),
				onValueChange: (_event, picked) => commit(picked),
			});
			return;
		}
		setOpen((current) => !current);
	};

	return (
		<View className="gap-1.5" testID={testID}>
			<Label isRequired={isRequired} isInvalid={isInvalid} isDisabled={isDisabled}>
				{label}
			</Label>
			<View
				className={cx(
					"min-h-12 flex-row items-center rounded-field",
					variant === "secondary" ? "bg-background" : "bg-field",
					isInvalid && "border border-danger",
					isDisabled && "opacity-50",
				)}
			>
				<Pressable
					onPress={press}
					disabled={isDisabled}
					accessibilityRole="button"
					accessibilityLabel={`${label}, ${shown ?? placeholder}`}
					accessibilityHint={isInvalid ? errorMessage : description}
					accessibilityState={{
						disabled: isDisabled,
						...(Platform.OS === "ios" ? { expanded: open } : {}),
					}}
					className="min-h-12 flex-1 flex-row items-center justify-between gap-2 px-3"
				>
					<Text size="base" className={cx(!shown && "text-field-placeholder")} numberOfLines={1}>
						{shown ?? placeholder}
					</Text>
					{shown && clearLabel ? null : <Icon name="calendar-blank" size={size.icon.md} tone="muted" />}
				</Pressable>
				{shown && clearLabel && !isDisabled ? (
					<IconButton
						icon="x"
						label={clearLabel}
						size="sm"
						onPress={() => {
							setOpen(false);
							onChange(null);
						}}
						className="me-1"
					/>
				) : null}
			</View>
			{open && Platform.OS === "ios" ? (
				<DateTimePicker
					value={date ?? initial()}
					mode="date"
					display="inline"
					accentColor={accent}
					themeVariant={scheme}
					{...(locale ? { locale } : {})}
					{...(min ? { minimumDate: min } : {})}
					{...(max ? { maximumDate: max } : {})}
					onValueChange={(_event, picked) => commit(picked)}
					testID={testID ? `${testID}-calendar` : undefined}
				/>
			) : null}
			{description && !isInvalid ? <Description>{description}</Description> : null}
			{errorMessage ? <FieldError isInvalid={isInvalid}>{errorMessage}</FieldError> : null}
		</View>
	);
}
