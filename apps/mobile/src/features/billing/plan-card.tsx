import type { PlanSummary } from "./plan";
import type { IconName } from "@/ui";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { getPlanName } from "./plan";
import { Icon, Text, useReducedMotion, useTheme } from "@/ui";

// Paid plans get a coloured frame (as on the web): Plus deep blue, Pro AI deep violet into blue.
const frames = {
	plus: "linear-gradient(135deg, #2563eb, #1e40af)",
	"pro-ai": "linear-gradient(135deg, #5b21b6, #7e22ce, #1d4ed8)",
} as const;
const ICON_TILE = 48;
const white = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

type ShineProps = { children: ReactNode };

/** A slow light band across the plan name. Reduced motion keeps it still. */
function Shine({ children }: ShineProps) {
	const { motion } = useTheme();
	const reduced = useReducedMotion();
	const [width, setWidth] = useState(0);
	const progress = useSharedValue(0);

	useEffect(() => {
		if (reduced || width === 0) return;
		progress.set(0);
		progress.set(withRepeat(withTiming(1, { duration: motion.d3 * 8, easing: Easing.linear }), -1));
		return () => cancelAnimation(progress);
	}, [reduced, width, motion.d3, progress]);

	const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.get() * 2 - 1) * width }] }));

	return (
		<View
			style={{ alignSelf: "flex-start", overflow: "hidden" }}
			onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
		>
			{children}
			{reduced || width === 0 ? null : (
				<Animated.View
					pointerEvents="none"
					style={[
						StyleSheet.absoluteFill,
						{ backgroundImage: `linear-gradient(90deg, transparent, ${white(0.35)}, transparent)` },
						sweep,
					]}
				/>
			)}
		</View>
	);
}

type StretchRowProps = { icon: IconName; title: string; subtitle: string; shine?: boolean };

/** One stretch of a paid plan, now or queued, at headline size in white. */
function StretchRow({ icon, title, subtitle, shine = false }: StretchRowProps) {
	const { space } = useTheme();
	const name = (
		<Text variant="heading" weight={600} style={{ color: "#fff" }}>
			{title}
		</Text>
	);
	return (
		<View style={{ flexDirection: "row", alignItems: "center", gap: space.s3 }}>
			<View
				style={{
					width: ICON_TILE,
					height: ICON_TILE,
					alignItems: "center",
					justifyContent: "center",
					borderRadius: 12,
					backgroundColor: white(0.2),
					borderWidth: 1,
					borderColor: white(0.3),
				}}
			>
				<Icon name={icon} size={24} color="#fff" />
			</View>
			<View style={{ flex: 1, gap: 2 }}>
				{shine ? <Shine>{name}</Shine> : name}
				<Text variant="callout" style={{ color: white(0.9) }}>
					{subtitle}
				</Text>
			</View>
		</View>
	);
}

type PaidPlanCardProps = { plan: PlanSummary; formatDate: (date: Date) => string };

/**
 * The plan card for Plus and Pro AI (Android): the plan's colour behind frosted, shadowless content with white text,
 * the plan name shining, and queued passes at the same size, split by a rule that starts under the text.
 */
export function PaidPlanCard({ plan, formatDate }: PaidPlanCardProps) {
	const { t } = useLingui();
	const { radius, space } = useTheme();
	if (plan.planId === "free") return null;

	return (
		<View
			accessibilityRole="summary"
			style={{
				gap: space.s2,
				padding: space.s3,
				borderRadius: radius.rLg,
				overflow: "hidden",
				backgroundImage: frames[plan.planId],
			}}
		>
			<Text variant="caption" style={{ color: white(0.9) }}>
				{t`Your plan`}
			</Text>
			<View
				style={{
					gap: space.s5,
					padding: space.s3,
					borderRadius: radius.rLg,
					backgroundColor: "rgba(0, 0, 0, 0.15)",
					borderWidth: 1,
					borderColor: white(0.2),
				}}
			>
				<StretchRow
					shine
					icon={plan.planId === "pro-ai" ? "sparkle" : "seal-check"}
					title={getPlanName(plan.planId)}
					subtitle={plan.currentPeriodEndsAt ? t`Active until ${formatDate(plan.currentPeriodEndsAt)}` : t`No end date`}
				/>
				{plan.upcoming.map((next) => (
					<View key={`${next.planId}-${next.startsAt.toISOString()}`}>
						<View
							style={{
								position: "absolute",
								top: -space.s5 / 2,
								start: ICON_TILE + space.s3,
								end: 0,
								height: StyleSheet.hairlineWidth,
								backgroundColor: white(0.25),
							}}
						/>
						<StretchRow
							icon="calendar-blank"
							title={t`Then ${getPlanName(next.planId)}`}
							subtitle={t`From ${formatDate(next.startsAt)} until ${formatDate(next.endsAt)}`}
						/>
					</View>
				))}
			</View>
		</View>
	);
}
