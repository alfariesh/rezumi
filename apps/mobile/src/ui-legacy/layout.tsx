import type { IconName } from "./icon";
import type { ColorToken } from "./tokens";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp } from "react-native-reanimated";
import { Button, IconButton } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";
import { useTheme } from "./theme";
import { useReducedMotion } from "@/ui/motion";

type Action = { label: string; onPress: () => void };

export type EmptyStateProps = {
	icon?: IconName | undefined;
	title: string;
	message?: string | undefined;
	action?: Action | undefined;
	/** A second, quieter action under the first. */
	secondaryAction?: Action | undefined;
};

export function EmptyState({ icon, title, message, action, secondaryAction }: EmptyStateProps) {
	const { colors, radius, size, space } = useTheme();

	return (
		<View style={{ alignItems: "center", gap: space.s3, paddingVertical: space.s10, paddingHorizontal: space.s6 }}>
			{icon ? (
				<View
					style={{
						width: size.hit + space.s5,
						height: size.hit + space.s5,
						marginBottom: space.s1,
						borderRadius: radius.rLg,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: colors.sunken,
					}}
				>
					<Icon name={icon} size={size.icon.bar + space.s2} color={colors.ink2} />
				</View>
			) : null}
			<Text accessibilityRole="header" variant="heading" align="center" style={{ alignSelf: "stretch" }}>
				{title}
			</Text>
			{message ? (
				<Text color="ink2" align="center" style={{ maxWidth: size.panel - space.s12 * 2 }}>
					{message}
				</Text>
			) : null}
			{action ? (
				<View style={{ alignSelf: "center" }}>
					<Button label={action.label} onPress={action.onPress} />
				</View>
			) : null}
			{secondaryAction ? (
				<View style={{ alignSelf: "center" }}>
					<Button variant="ghost" label={secondaryAction.label} onPress={secondaryAction.onPress} />
				</View>
			) : null}
		</View>
	);
}

/** `accent` is the success banner (for example "Imported from LinkedIn"). */
export type BannerTone = "info" | "warn" | "danger" | "accent";

/** The app-wide banners from the old design system: each sets its tone and icon. The screen still supplies the copy. */
export type BannerVariant = "offline" | "locked" | "guest" | "sessionExpired";

export type BannerProps = {
	/** `info`: offline and neutral guidance. `warn`: guest, session expired. `danger`: errors. Defaults from `variant`. */
	tone?: BannerTone | undefined;
	variant?: BannerVariant | undefined;
	message: string;
	title?: string | undefined;
	icon?: IconName | undefined;
	action?: Action | undefined;
	/** Several actions, for example Create account and Sign in on the guest banner. */
	actions?: Action[] | undefined;
	onDismiss?: (() => void) | undefined;
	/** A full-width status strip under the top bar (offline), instead of a rounded card in the content. */
	strip?: boolean | undefined;
};

const bannerColors = {
	info: { background: "infoSoft", text: "infoText" },
	warn: { background: "warnSoft", text: "warnText" },
	danger: { background: "dangerSoft", text: "dangerText" },
	accent: { background: "accentSoft", text: "accentText" },
} as const satisfies Record<BannerTone, { background: ColorToken; text: ColorToken }>;

const bannerVariants = {
	offline: { tone: "info", icon: "cloud-slash" },
	locked: { tone: "info", icon: "lock" },
	guest: { tone: "warn", icon: "warning-circle" },
	sessionExpired: { tone: "warn", icon: "clock" },
} as const satisfies Record<BannerVariant, { tone: BannerTone; icon: IconName }>;

export function Banner({ tone, variant, message, title, icon, action, actions, onDismiss, strip }: BannerProps) {
	const { t } = useLingui();
	const { colors, fonts, motion, radius, size, space } = useTheme();
	const reduced = useReducedMotion();
	const preset = variant ? bannerVariants[variant] : undefined;
	const palette = bannerColors[tone ?? preset?.tone ?? "info"];
	const glyph = icon ?? preset?.icon;
	const buttons = [...(action ? [action] : []), ...(actions ?? [])];

	return (
		<Animated.View
			entering={reduced ? FadeIn.duration(motion.d1) : FadeInUp.duration(motion.d2)}
			exiting={reduced ? FadeOut.duration(motion.d1) : FadeOutUp.duration(motion.d2)}
			accessibilityRole={palette.text === "dangerText" ? "alert" : undefined}
			accessibilityLiveRegion="polite"
			style={{
				flexDirection: "row",
				alignItems: strip ? "center" : "flex-start",
				gap: strip ? space.s2 : space.s3,
				minHeight: strip ? size.hit - space.s2 : undefined,
				paddingVertical: strip ? space.s1 + space.s0 : space.s3,
				paddingHorizontal: strip ? space.s4 : space.s3,
				borderRadius: strip ? 0 : radius.rLg,
				backgroundColor: colors[palette.background],
			}}
		>
			{glyph ? <Icon name={glyph} size={strip ? size.icon.meta : size.icon.row} color={colors[palette.text]} /> : null}
			<View style={{ flex: 1, gap: space.s0 }}>
				{title ? (
					<Text variant="callout" weight={600} color={palette.text}>
						{title}
					</Text>
				) : null}
				<Text variant={strip ? "caption" : "callout"} color={palette.text}>
					{message}
				</Text>
				{buttons.length > 0 ? (
					<View style={{ flexDirection: "row", flexWrap: "wrap", marginStart: -space.s2, marginBottom: -space.s2 }}>
						{buttons.map((button) => (
							<Pressable
								key={button.label}
								accessibilityRole="button"
								onPress={button.onPress}
								style={({ pressed }) => ({
									minHeight: size.hit,
									justifyContent: "center",
									paddingHorizontal: space.s2,
									opacity: pressed ? 0.6 : 1,
								})}
							>
								<Text
									variant="callout"
									color={palette.text}
									style={{ fontFamily: fonts.ui[600], textDecorationLine: "underline" }}
								>
									{button.label}
								</Text>
							</Pressable>
						))}
					</View>
				) : null}
			</View>
			{onDismiss ? (
				<View style={{ margin: -space.s3 }}>
					<IconButton icon="x" label={t`Dismiss`} size={size.icon.meta} color={palette.text} onPress={onDismiss} />
				</View>
			) : null}
		</Animated.View>
	);
}
