// Navigation inside a screen: HeroUI's Tabs for panels, Pro's Segment for 2–4 options, Pro's Stepper for onboarding
// steps and Pro's FAB for the one floating action of a list screen (web DESIGN.md → Inputs; plans/mobile 01-desain 6:
// the web's section menu becomes a scrollable segment under the title).
import type { IconName } from "./icon";
import { FAB } from "heroui-native-pro/fab";
import { Segment as ProSegment } from "heroui-native-pro/segment";
import { Stepper as ProStepper } from "heroui-native-pro/stepper";
import { Fragment } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { haptics } from "./motion";
import { useWindowSafeAreaInsets } from "./safe-area";
import { Text } from "./text";
import { size, space } from "./tokens";

export { Tabs } from "heroui-native";

const noop = () => undefined;

export type SegmentOption<T extends string> = {
	value: T;
	/** Shown, and read by screen readers; with `hideLabel` only read. */
	label: string;
	icon?: IconName | undefined;
	isDisabled?: boolean | undefined;
};

export type SegmentProps<T extends string> = {
	/** Two to four options. More, or long labels, belong in Tabs with a scroll view or a Select. */
	options: readonly SegmentOption<T>[];
	value: T;
	onValueChange: (value: T) => void;
	/** Names the group for screen readers ("View", "Theme"). */
	accessibilityLabel: string;
	size?: "sm" | "md" | "lg" | undefined;
	/** Icon-only items (a light/dark/system switch); every option then needs an icon. */
	hideLabel?: boolean | undefined;
	isDisabled?: boolean | undefined;
	className?: string | undefined;
};

/** A segmented control: picks one of a few views or values at once, with a selection haptic. */
export function Segment<T extends string>({
	options,
	value,
	onValueChange,
	accessibilityLabel,
	size: segmentSize = "md",
	hideLabel = false,
	isDisabled = false,
	className,
}: SegmentProps<T>) {
	const change = (next: string) => {
		const option = options.find((item) => item.value === next);
		if (!option || option.value === value) return;
		haptics.selection();
		onValueChange(option.value);
	};
	// The items are 36–42 pt tall; the slop brings the target to 44 pt without making the control look heavier.
	const slop = segmentSize === "lg" ? 0 : segmentSize === "md" ? 4 : 8;
	return (
		<ProSegment
			value={value}
			onValueChange={change}
			size={segmentSize}
			isDisabled={isDisabled}
			className={cx(className)}
		>
			<ProSegment.Group accessibilityLabel={accessibilityLabel}>
				<ProSegment.Indicator />
				{options.map((option, index) => {
					const previous = options[index - 1];
					const selected = option.value === value;
					return (
						<Fragment key={option.value}>
							{previous ? <ProSegment.Separator betweenValues={[previous.value, option.value]} /> : null}
							<ProSegment.Item
								value={option.value}
								isDisabled={option.isDisabled ?? false}
								accessibilityLabel={option.label}
								hitSlop={{ top: slop, bottom: slop }}
								className="flex-1"
							>
								{option.icon ? (
									<Icon
										name={option.icon}
										size={size.icon.sm}
										variant={selected ? "duotone" : "stroke"}
										tone={selected ? "segment-foreground" : "muted"}
									/>
								) : null}
								{hideLabel ? null : <ProSegment.Label numberOfLines={1}>{option.label}</ProSegment.Label>}
							</ProSegment.Item>
						</Fragment>
					);
				})}
			</ProSegment.Group>
		</ProSegment>
	);
}

export type StepperStep = { title: string; description?: string | undefined };

export type StepperProps = {
	steps: readonly StepperStep[];
	/** Zero-based index of the step the person is on. */
	currentStep: number;
	/**
	 * Going back: pressing a finished step calls it with that step's index. Steps ahead are never pressable (the screen's
	 * Continue button moves forward). Without it no step is pressable.
	 */
	onStepChange?: ((step: number) => void) | undefined;
	orientation?: "horizontal" | "vertical" | undefined;
	/** Read before each title, from 1: `(2, 4) => "Step 2 of 4"`. */
	stepLabel?: ((step: number, total: number) => string) | undefined;
	className?: string | undefined;
};

/** Onboarding and multi-step forms: numbered steps, a check on finished ones, the current one in accent. */
export function Stepper({
	steps,
	currentStep,
	onStepChange,
	orientation = "vertical",
	stepLabel,
	className,
}: StepperProps) {
	return (
		<ProStepper
			currentStep={currentStep}
			onStepChange={(step) => {
				if (step < currentStep) onStepChange?.(step);
			}}
			orientation={orientation}
			className={cx(className)}
		>
			{steps.map((step, index) => {
				const pressable = !!onStepChange && index < currentStep;
				return (
					<ProStepper.Step
						key={index}
						accessible
						accessibilityRole={pressable ? "button" : undefined}
						accessibilityLabel={[stepLabel?.(index + 1, steps.length), step.title, step.description]
							.filter(Boolean)
							.join(", ")}
						accessibilityState={{ selected: index === currentStep, disabled: !!onStepChange && index > currentStep }}
						hitSlop={orientation === "horizontal" ? undefined : 4}
						className={cx(orientation === "vertical" && "min-h-11")}
					>
						<ProStepper.Rail />
						<ProStepper.Content>
							<ProStepper.Title>{step.title}</ProStepper.Title>
							{step.description ? <ProStepper.Description>{step.description}</ProStepper.Description> : null}
						</ProStepper.Content>
					</ProStepper.Step>
				);
			})}
		</ProStepper>
	);
}

export type FabAction = { key: string; label: string; icon: IconName; onPress: () => void };

export type FabProps = {
	icon: IconName;
	/** Always read by screen readers; shown beside the icon unless `extended` is false. */
	label: string;
	/** Icon and label (default). An icon-only FAB keeps the label for screen readers. Ignored with `actions`. */
	extended?: boolean | undefined;
	onPress?: (() => void) | undefined;
	/** A speed dial: the trigger opens these instead of acting itself (the icon turns 45°, so use `plus`). */
	actions?: readonly FabAction[] | undefined;
	/**
	 * Floats at the bottom end of the screen, 16 pt above the bottom safe area (default). Inside a section's screen, whose frame
	 * already ends above the home indicator, pass `safeArea={false}`; `floating={false}` lays it out in place (gallery, tests).
	 */
	floating?: boolean | undefined;
	safeArea?: boolean | undefined;
	isDisabled?: boolean | undefined;
	className?: string | undefined;
	testID?: string | undefined;
};

/** The one floating action of a list screen (New application), in accent. Never more than one per screen. */
export function Fab({
	icon,
	label,
	extended = true,
	onPress,
	actions,
	floating = true,
	safeArea = true,
	isDisabled = false,
	className,
	testID,
}: FabProps) {
	const insets = useWindowSafeAreaInsets();
	const dial = !!actions?.length;
	const wide = extended && !dial;
	return (
		<FAB
			{...(dial ? {} : { isOpen: false, onOpenChange: noop })}
			isDisabled={isDisabled}
			testID={testID}
			className={cx(floating && "absolute end-4", className)}
			style={floating ? { bottom: (safeArea ? insets.bottom : 0) + space[4] } : undefined}
		>
			<FAB.Trigger
				onPress={dial ? undefined : onPress}
				accessibilityLabel={label}
				// A single action opens nothing: drop the "collapsed" state the speed dial announces.
				{...(dial ? {} : { "aria-expanded": undefined })}
				// The speed dial turns its icon 45° as it opens; a single action never turns.
				isAnimatedStyleActive={dial}
				classNames={{
					container: cx(wide && "w-auto px-5"),
					contentContainer: cx(wide && "flex-row gap-2"),
				}}
			>
				<Icon name={icon} size={size.icon.lg} tone="accent-foreground" />
				{wide ? (
					<Text size="base" weight="medium" className="text-accent-foreground">
						{label}
					</Text>
				) : null}
			</FAB.Trigger>
			{dial ? (
				<FAB.Portal>
					<FAB.Overlay />
					<FAB.Content>
						{actions.map((action) => (
							<FAB.Item key={action.key} onPress={action.onPress} accessibilityLabel={action.label}>
								<Icon name={action.icon} size={size.icon.md} />
								<FAB.ItemLabel>{action.label}</FAB.ItemLabel>
							</FAB.Item>
						))}
					</FAB.Content>
				</FAB.Portal>
			) : null}
		</FAB>
	);
}
