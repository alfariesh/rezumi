// Text. Titles and paragraphs use HeroUI's `Typography` (the web's scale: page title h2 30/36, section h4 20/28, card
// or row title h6 16/24, paragraphs body-sm 14/24). One-line labels, captions and values use `Text`: a step's own
// leading, which a paragraph type would make too loose for rows and chips (web DESIGN.md → Typography).
import type { ReactNode } from "react";
import type { TextProps as NativeTextProps } from "react-native";
import { Text as NativeText } from "react-native";
import { cx } from "./cx";

export { Typography } from "heroui-native";

const sizes = { xs: "text-xs", sm: "text-sm", base: "text-base" } as const;
const weights = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" } as const;
const tones = {
	default: "text-foreground",
	muted: "text-muted",
	accent: "text-accent",
	danger: "text-danger",
	success: "text-success-soft-foreground",
	warning: "text-warning-soft-foreground",
} as const;

export type TextProps = Omit<NativeTextProps, "style"> & {
	/** 14 (default), 12 for captions and group labels, 16 for inputs and prominent values. */
	size?: keyof typeof sizes | undefined;
	weight?: keyof typeof weights | undefined;
	tone?: keyof typeof tones | undefined;
	/** Google Sans Code: URLs, slugs, file names, shortcuts and counts. */
	mono?: boolean | undefined;
	/** Columns of numbers (counts, prices, scores) line up. */
	tabular?: boolean | undefined;
	className?: string | undefined;
	children?: ReactNode;
};

/** One-line interface text. Grows with the system text size up to 1.6× so rows keep their shape. */
export function Text({
	size = "sm",
	weight = "normal",
	tone = "default",
	mono = false,
	tabular = false,
	className,
	maxFontSizeMultiplier = 1.6,
	...props
}: TextProps) {
	return (
		<NativeText
			maxFontSizeMultiplier={maxFontSizeMultiplier}
			{...props}
			className={cx(
				sizes[size],
				mono ? "font-mono" : weights[weight],
				tones[tone],
				tabular && "tabular-nums",
				className,
			)}
		/>
	);
}
